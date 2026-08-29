# PoloRank — Módulo de Auditoría SEO continua (propuesta de arquitectura)

**Fecha:** 2026-08-29 · **Estado:** PROPUESTA — nada aprobado, nada construido, cero código tocado.
**Autor:** `fullstack-architect-nextjs` · **Requiere:** OK de Fabián por fase, con ticket y respaldo (LEY de cambios).

Restricción que manda sobre todo lo demás: **el tracking de posiciones, el cron diario, la tabla de
keywords y Search Console tienen que seguir funcionando exactamente igual.** Todo el diseño está
subordinado a eso.

---

## 0. Lo que encontré en el código (base de las decisiones)

Verificado leyendo el repo, no asumido:

| Hecho | Consecuencia para este diseño |
|---|---|
| `cron.js` es un **proceso aparte** que solo hace HTTP a `localhost:3000` con `Bearer APIKEY`. El trabajo real ocurre **dentro del server de Next**. | Una auditoría lanzada por cron correría en el mismo event loop que el scrape. Es EL problema de aislamiento. |
| `cron.js` lee `data/settings.json` **una sola vez al arrancar**. Cambiar `scrape_interval` desde la UI no toma efecto hasta reiniciar el contenedor. | No poner el intervalo de auditoría en `settings.json`: repetiría la trampa. |
| **No hay timeouts en ningún fetch** del proyecto (`axios-retry` está declarado y nunca se importa). No hay locks en ningún lado. | El crawler no puede heredar esto. `AbortController` obligatorio. |
| SQLite en `journal_mode = delete` (sin WAL), `pool.max = 5`, y `db.sync()` se llama al inicio de **cada** handler de API. | Un segundo escritor pesado va a producir `SQLITE_BUSY`. Riesgo directo sobre el scrape. |
| `db.sync()` crea tablas faltantes **sin índices**; la migración después ve la tabla existente y **salta el bloque, incluidos los `addIndex`**. | Bug real ya presente. Hay que verificar si `keyword_daily` tiene su índice único en producción. |
| `cheerio ^1.2.0` ya es dependencia (la usan los scrapers). `chart.js 3.9` + `react-chartjs-2 4.3` ya están. | El crawler y las donas **no necesitan ninguna dependencia nueva**. |
| El Dockerfile borra `package.json` y reinstala a mano lo que Next no traza. | Cualquier dep nueva que use `cron.js` hay que agregarla a esa lista. Las que usan las rutas de API sí se trazan solas. |
| Migraciones: transacción + `try/catch` que se traga el error + guardas de idempotencia. `entrypoint.sh` no tiene `set -e`. | Una migración que falla **no** detiene el arranque y queda marcada como aplicada. Hay que probarla contra copia de la base real, como se hizo en el ticket del historial diario. |
| No hay una sola asociación Sequelize declarada. Las relaciones son por columnas sueltas (`keyword.domain` es un string). | Las tablas nuevas siguen la misma convención: sin FK, se relacionan por `domain` + `url`. |

### Tamaño real de los sitios (medido hoy, vía sitemap)

| Dominio | URLs en sitemap | Peso medio de página |
|---|---|---|
| goaraucania.cl | 4 | — |
| maderasfresard.com | 13 | 97 KB |
| ammo.cl | 17 | 244 KB |
| emignia.com | 30 | — |
| **mavae.cl** | **1.591** (1.560 productos) | 358 KB |

**El 94% del problema de tamaño es un solo sitio.** Cuatro de cinco dominios se auditan enteros en
menos de 35 peticiones. Eso define el diseño del presupuesto de crawl: no hace falta una máquina
sofisticada, hace falta un tope y una buena priorización para mavae.

Además, `data/SC_mavae.cl.json` (ya en disco, gratis) tiene **125 páginas distintas con datos de GSC
en 30 días**. O sea: de 1.591 URLs, 125 son las que realmente reciben búsquedas. Ese archivo es la
lista de prioridad y ya existe.

---

## 1. Modelo de datos

Cuatro tablas nuevas, siguiendo exactamente el patrón de `keyword_daily`: capa nueva que se llena
hacia adelante, sin tocar nada existente.

### 1.1 `audit_run` — una fila por auditoría de un dominio

```
ID               INTEGER PK autoincrement
domain           STRING   NOT NULL   -- mismo string que keyword.domain (sin FK, convención del proyecto)
date             STRING   NOT NULL   -- 'YYYY-M-D', mismo formato que keyword.history
started_at       STRING   NOT NULL
finished_at      STRING
status           STRING   NOT NULL   -- 'running' | 'ok' | 'partial' | 'error'
trigger          STRING   NOT NULL   -- 'cron' | 'user:<ID>'
catalog_version  INTEGER  NOT NULL   -- versión del catálogo de checks usada en esta corrida
pages_crawled    INTEGER  DEFAULT 0
pages_discovered INTEGER  DEFAULT 0  -- cuántas URLs se conocían (sitemap ∪ enlaces)
pages_budget     INTEGER  DEFAULT 0  -- el tope que se aplicó
bytes_fetched    INTEGER  DEFAULT 0
duration_ms      INTEGER  DEFAULT 0
cost_usd         DECIMAL(10,6) DEFAULT 0
error            STRING   DEFAULT ''
```
Índices: `UNIQUE (domain, date)`, `(domain, started_at)`.

`pages_crawled` vs `pages_discovered` no es decorativo: es lo que permite que la pantalla diga
**"se revisaron 300 de 1.591 URLs"** en vez de presentar una foto parcial como si fuera completa.
Es la regla de procedencia de datos aplicada al producto.

### 1.2 `audit_check_result` — una fila por check por corrida (la serie histórica)

```
ID          INTEGER PK
run_id      INTEGER NOT NULL
domain      STRING  NOT NULL    -- desnormalizado: permite la serie de un check sin join
date        STRING  NOT NULL
block       STRING  NOT NULL    -- 'tecnico' | 'onpage' | 'arquitectura' | ...
check_id    STRING  NOT NULL    -- slug estable, ej. 'onp.title.duplicate'
status      STRING  NOT NULL    -- 'pass' | 'warn' | 'fail' | 'na' | 'error'
score       INTEGER NOT NULL    -- 0..100, lo que alimenta la dona
severity    STRING  NOT NULL    -- FOTO de la severidad al momento de correr
weight      INTEGER NOT NULL    -- FOTO del peso al momento de correr
affected    INTEGER DEFAULT 0
total       INTEGER DEFAULT 0
evidence    TEXT    DEFAULT '[]' -- JSON con los hechos crudos que justifican el veredicto (tope 20 ejemplos)
```
Índices: `UNIQUE (run_id, check_id)`, `(domain, check_id, date)` ← este es el que hace barata la
pregunta "cómo evolucionó este check".

### 1.3 `audit_block_score` — el resumen por bloque, desnormalizado

```
ID, run_id, domain, date, block,
score INTEGER,            -- 0..100 ponderado
checks_total, passed, warned, failed, na, errored,
weight_total INTEGER
```
Índice: `(domain, block, date)`.

Se puede derivar de la tabla anterior, y aun así se guarda. Razón: la pantalla del dominio tiene que
pintar 8 donas + 8 sparklines de tendencia en una consulta barata. Son 8 filas por corrida — nada.

### 1.4 `audit_page` — la foto del crawl, página por página

```
ID, run_id, domain, date, url,
status_code INTEGER, redirect_to STRING, content_type STRING, bytes INTEGER,
indexable BOOLEAN, noindex BOOLEAN, canonical STRING, canonical_self BOOLEAN,
title STRING, title_len INTEGER,
meta_desc STRING, meta_desc_len INTEGER,
h1 STRING, h1_count INTEGER, heading_gaps INTEGER,
word_count INTEGER, images INTEGER, images_no_alt INTEGER,
schema_types STRING,          -- JSON ['Product','BreadcrumbList']
depth INTEGER,                -- clics desde la home (link graph)
inlinks INTEGER, outlinks INTEGER,
in_sitemap BOOLEAN, gsc_clicks INTEGER, gsc_impressions INTEGER,
fetched_at STRING, fetch_error STRING
```
Índices: `(run_id)`, `(domain, url, date)`.

### 1.5 Configuración por dominio

Una columna nueva en `domain`: **`audit_settings STRING`** (JSON, nullable).

```jsonc
{
  "enabled": true,
  "interval": "weekly",          // 'never' | 'weekly' | 'daily'
  "maxPages": 300,
  "blocks": { "backlinks": false },   // bloques apagados
  "excludePaths": ["/carrito", "/mi-cuenta"],
  "userAgent": "default"
}
```

Por qué JSON y no columnas sueltas: la configuración de auditoría va a crecer (topes por bloque,
rutas excluidas, credenciales). Precedente en el propio proyecto: `keyword.settings` guarda el
override de profundidad como JSON, y `domain.search_console` guarda un objeto. Columnas sueltas
obligarían a una migración por cada opción nueva.

### 1.6 Cómo se relaciona con `domain` y `keyword`

Por string, como todo en este proyecto: `audit_run.domain === keyword.domain === domain.domain`.
Sin FK. La unión interesante es **al leer**: `audit_page.url` contra `keyword.target_url`,
normalizando con las funciones que ya existen en `utils/targetUrl.ts` (`sameUrl`, `targetPath`).

Eso habilita el check más valioso de todos, y es la razón por la que este módulo vale más adentro de
PoloRank que en una herramienta genérica: **"toda URL objetivo de una keyword responde 200 y es
indexable"**. Ese check habría detectado solo el desastre de mavae del 25-ago (10 etiquetas-ruta
convertidas a URL objetivo que redirigían a la home) sin que nadie tuviera que revisarlas a mano.

### 1.7 Cómo los checks cambian sin romper el histórico

Esta es la decisión central del modelo. Cuatro reglas:

1. **`check_id` es un slug estable en el código, jamás una FK a una tabla de catálogo.** El catálogo
   vive en `utils/audit/catalog/`, versionado en git. La base solo guarda resultados.
2. **`severity` y `weight` se guardan como foto en cada fila.** El puntaje de una corrida de hace tres
   meses se calcula con los pesos de entonces, no con los de hoy.
3. **Nunca se recalcula el pasado.** Agregar un check no reescribe corridas anteriores; el check nuevo
   simplemente no tiene filas antes de su primera corrida, y la UI dice *"sin datos antes del
   <fecha>"* en vez de mostrar un cero falso. Es exactamente la lección del ticket que eliminó la
   constante `101`: un relleno no es un dato.
4. **`catalog_version` sube cuando cambian pesos o criterios**, para que la pantalla pueda decir
   *"el criterio cambió el <fecha>"* en lugar de mostrar un salto de puntaje inexplicable.

Un check retirado conserva su historia. El código lleva un mapa `RETIRED` con su etiqueta, para que
la serie histórica nunca se renderice como un código huérfano.

### 1.8 Retención y tamaño

- `audit_check_result` y `audit_block_score`: **se guardan para siempre.** Son la memoria del módulo.
  26 checks × 5 dominios × 52 semanas ≈ 6.760 filas/año ≈ **3 MB/año**.
- `audit_page`: **se poda.** Se conservan las últimas 8 corridas + la primera de cada mes. El resto se
  borra al cerrar cada corrida. ~300 páginas × 600 B × 20 corridas conservadas × 5 dominios ≈ **18 MB**
  en régimen, sin crecer indefinidamente.
- Total estimado: **~20-25 MB el primer año**, contra 23 GB libres en el VPS. Comparable a los 36 MB/año
  que ya cuesta el historial diario de keywords.
- Ojo: SQLite **no se achica al borrar**. El `VACUUM` queda como acción manual del panel de admin,
  nunca automática — bloquea la base entera mientras corre.

---

## 2. Motor de auditoría

### 2.1 Dónde corre — y cómo no puede tumbar el scrape

El scrape de posiciones corre dentro del server de Next, disparado por HTTP desde `cron.js`. Si la
auditoría corre ahí también, comparten event loop y memoria. Dos caminos:

**Opción A — mismo proceso, aislado por presupuesto y candado. (RECOMENDADA)**

Sin infraestructura nueva, igual que todo lo demás del proyecto. El aislamiento se consigue con
límites duros, no con procesos:

| Límite | Valor por defecto | Por qué |
|---|---|---|
| `perRequestTimeout` | 10 s (`AbortController`) | El proyecto hoy no tiene timeouts en ningún fetch. Este no repite ese error. |
| `maxBytesPerPage` | 2 MB (se corta el stream) | Una página patológica no puede llenar la memoria. |
| `concurrency` | 2 | Techo de memoria: 2 documentos cheerio vivos ≈ 6-8 MB. |
| `politenessDelay` | 500 ms | Es el servidor de un cliente, no nuestro. |
| `maxPages` | 300 por dominio | Configurable por dominio. |
| `totalWallClock` | 10 min por dominio | Corta y marca la corrida como `partial`, nunca cuelga. |
| `maxRunsInFlight` | 1 (global) | Nunca dos auditorías a la vez. |

Y tres candados:
1. **La auditoría no arranca si hay un scrape en curso** — se comprueba `Keyword.count({ where: { updating: true } }) === 0`. El scrape tiene prioridad absoluta.
2. **`audit_run.status = 'running'` con `UNIQUE (domain, date)` es el candado de la corrida**, en base, no en memoria. Si el contenedor muere a mitad, la corrida queda `running` y la siguiente la marca `error` por antigüedad y sigue.
3. **Nunca se guardan todas las páginas en memoria.** Se procesa y se persiste página por página; el crawler es un generador, no un array.

**Opción B — proceso hijo (`child_process.fork` con `--max-old-space-size=192`).**
Aislamiento real de memoria: si revienta, muere solo el worker. Pero exige WAL sí o sí (dos procesos
escribiendo SQLite), sumar dependencias a la lista manual del Dockerfile, y resolver cómo un proceso
plano ejecuta los utils de TypeScript bajo Next 12 standalone. **No lo justifico con 5 dominios y
1.655 URLs.** Queda anotado como el camino si los dominios pasan de ~20 o un sitio supera las ~2.000
URLs con presupuesto completo.

**Prerrequisito de ambas: activar WAL.** Ticket propio, respaldo propio (ver fase 0). Hoy la base está
en `journal_mode = delete`: el escritor bloquea a los lectores. Meter un segundo escritor pesado ahí
es la forma más probable de que este módulo rompa el tracking. WAL permite un escritor + varios
lectores en paralelo y beneficia al sistema actual aunque la auditoría nunca se construya.

### 2.2 Regla de dependencias (verificable)

**Nada del módulo de auditoría puede ser importado por el camino de tracking.** La flecha apunta en un
solo sentido: `utils/audit/*` lee datos de keywords; `utils/refresh.ts`, `utils/scraper.ts` y
`cron.js` **jamás** importan nada de `utils/audit/`. Se fija con una prueba que hace grep de los
imports y falla si alguien invierte la flecha. Es la garantía mecánica de "una mejora, no una
destrucción".

Además, todo el módulo sigue el patrón `recordDailySnapshot`: **nunca lanza hacia afuera.** Cada check
va en su propio `try/catch` y falla como `status: 'error'` solo para sí mismo. Un crawler caído
produce una corrida `partial` con lo que alcanzó, no una excepción.

### 2.3 Cuándo corre

- **Semanal por defecto**, no diario. Las posiciones cambian a diario; el on-page no. Crawlear el sitio
  de un cliente todos los días es gasto, ruido en el gráfico y descortesía con su servidor. 7× menos
  costo y una tendencia legible.
- **Bajo demanda** desde la pantalla (solo superadmin), para cuando Fabián acaba de arreglar algo y
  quiere ver el efecto.
- **Horario:** `cron.js` dispara `POST /api/audit/run` **todos los días a las 05:00 UTC** (01:00 Chile).
  El scrape es a las 00:00 UTC, las notificaciones a las 03:00, Search Console a las 00:00. Las 05:00
  están libres.

**Desviación deliberada del patrón vigente, que presento como decisión:** el cron dispara *todos los
días*, y **el endpoint decide qué dominios corresponden** según `audit_settings.interval` y la fecha
del último `audit_run`. El patrón actual del proyecto es al revés (el cron lee el intervalo de
`settings.json`), pero ese patrón tiene una trampa conocida: `cron.js` lee `settings.json` una sola
vez al arrancar, así que cambiar el intervalo desde la UI no hace nada hasta reiniciar el contenedor.
Poner la decisión en el endpoint elimina la trampa y deja el calendario en la base, donde la pantalla
sí lo puede cambiar. Si preferís copiar el patrón existente tal cual, se copia — pero quería que la
diferencia estuviera sobre la mesa y no escondida.

### 2.4 Cómo se crawlea un sitio grande sin reventar el VPS

Cuatro pasos, apoyados en los números reales medidos:

1. **Enumerar barato.** `robots.txt` → sitemap index → sitemaps hijos. Dos o tres peticiones dan la
   lista completa en los cinco dominios. Se respeta `Disallow` y `Crawl-delay`.
2. **Priorizar antes de recortar.** El presupuesto no corta por orden alfabético:
   - **Nivel 1:** la home + **toda `keyword.target_url`** del dominio. Son las páginas por las que el
     negocio está apostando y ya están declaradas en la base.
   - **Nivel 2:** páginas con clics o impresiones en GSC en 30 días — se leen de `data/SC_<dominio>.json`,
     que ya está en disco y es gratis. En mavae son **125 de 1.591**.
   - **Nivel 3:** páginas a un clic de la home (profundidad 1).
   - **Nivel 4:** el resto del sitemap, muestreado.
3. **Cortar en `maxPages`** y guardar en `audit_run` tanto lo revisado como lo descubierto. La pantalla
   dice el número real. Nunca se presenta un crawl parcial como completo.
4. **Nivel 1 y 2 completos siempre.** Si `maxPages` no alcanza para cubrirlos, se avisa en la corrida en
   vez de recortarlos en silencio.

Con esto, mavae (el caso difícil) se audita con 300 peticiones: 7 páginas + 24 categorías + 125 con
tráfico real + las URL objetivo + una muestra del catálogo. Los otros cuatro dominios se auditan
enteros.

### 2.5 Catálogo de checks — agregar uno es agregar un objeto a un arreglo

Un check es una **función pura sobre la evidencia ya recolectada**. No hace peticiones, no toca la
base, no sabe de React. Se testea con un fixture, como ya se testean `history.ts`, `depth.ts` y
`targetUrl.ts`.

```ts
// utils/audit/types.ts
export type AuditContext = {
   domain: DomainType,
   pages: AuditPage[],            // lo que se crawleó
   home: AuditPage | null,
   robots: RobotsFacts,
   sitemaps: SitemapFacts,
   links: LinkGraph,
   gsc: SCDomainDataType | null,  // del archivo local, gratis
   psi: PsiFacts | null,
   keywords: KeywordType[],       // con target_url — la unión con el tracking
};

export type CheckOutcome = {
   status: 'pass' | 'warn' | 'fail' | 'na',
   score: number,                 // 0..100
   affected: number,
   total: number,
   evidence: EvidenceItem[],      // los hechos crudos, tope 20
   recommendation: string,        // qué hacer, en español
};

export type CheckDefinition = {
   id: string,                    // 'onp.title.duplicate' — estable para siempre
   block: AuditBlock,
   title: string,                 // "Ninguna página repite el title"
   how: string,                   // cómo se comprueba (se muestra en la UI)
   source: 'crawl' | 'gsc' | 'psi' | 'dataforseo' | 'manual',
   severity: 'critica' | 'alta' | 'media' | 'baja',
   weight: number,
   run: (ctx: AuditContext) => CheckOutcome,
};
```

Estructura:

```
utils/audit/
├── types.ts                 # contratos (se referencian desde types.d.ts como ya se hace con KeywordStats)
├── catalog/
│   ├── index.ts             # concatena los bloques + valida ids únicos + CATALOG_VERSION + RETIRED
│   ├── tecnico.ts           # export const checks: CheckDefinition[] = [...]
│   ├── onpage.ts
│   ├── arquitectura.ts
│   ├── enlazado.ts
│   ├── contenido.ts
│   ├── local.ts
│   ├── backlinks.ts
│   └── estrategia.ts
├── crawler.ts               # fetch con límites duros, robots, sitemap → AuditPage[]
├── linkGraph.ts             # profundidad, inlinks, huérfanas (puro)
├── engine.ts                # orquesta: crawl → contexto → correr catálogo → persistir
├── score.ts                 # puntaje ponderado por bloque (puro, testeable)
└── persist.ts               # escribe audit_run / audit_check_result / audit_block_score / audit_page
```

**Agregar un check = un objeto en un archivo.** El motor itera el registro; la API y la UI son
genéricas sobre él. Cero archivos adicionales.

Dos pruebas que fijan el contrato:
- todos los `id` son únicos y calzan con `^[a-z]+\.[a-z0-9-]+(\.[a-z0-9-]+)*$`;
- todo `check_id` presente en el histórico existe en el catálogo o está en `RETIRED` con su etiqueta.

### 2.6 Regla de honestidad de los checks

Un check que no tiene una regla determinista y verificable **no entra al catálogo automático**. Entra
con `source: 'manual'` y se muestra como *"pendiente de revisión humana"*.

Esto no es celo: es la lección que este proyecto ya pagó dos veces. La constante `101` producía un
número plausible y falso. El cruce de volúmenes con mayúsculas devolvía 0 en silencio para dos
dominios enteros. Un veredicto SEO inventado es más caro que un casillero vacío, porque el vacío se
nota y el inventado se cree. Por eso **cada resultado guarda la evidencia cruda que lo justifica** y la
pantalla la muestra.

---

## 3. Superficie de API

Todos bajo `pages/api/audit/`, con el mismo prólogo que el resto (`await db.sync()` → `authenticate()`
→ guarda → método).

| Endpoint | Método | Qué devuelve | Permiso |
|---|---|---|---|
| `/api/audit` | GET `?domain=` | Última corrida + 8 bloques con puntaje + serie de tendencia | `canAccessDomain` |
| `/api/audit/block` | GET `?domain=&block=` | Checks del bloque en la última corrida + serie por check | `canAccessDomain` |
| `/api/audit/check` | GET `?domain=&id=` | Serie histórica del check + evidencia de la última corrida | `canAccessDomain` |
| `/api/audit/pages` | GET `?domain=&run=&page=` | Páginas de la corrida, paginado | `canAccessDomain` |
| `/api/audit/runs` | GET `?domain=` | Lista de corridas (fecha, estado, páginas, duración, costo) | `canAccessDomain` |
| `/api/audit/run` | POST `{ domain }` | Lanza la auditoría (o decide qué toca, si viene del cron) | `isSuperadmin` **o** `viaApiKey` |
| `/api/audit/settings` | PUT `{ domain, audit_settings }` | Guarda la config del dominio | `isSuperadmin` |

Coherencia con la matriz de permisos ya aprobada (D4/D5): las lecturas siguen a `canAccessDomain`
—un usuario de dominio ya ve su tracking y su Insight, ver su auditoría es lo mismo—, y **lanzar** una
corrida es de superadmin por el mismo motivo por el que refrescar posiciones lo es: consume recursos y
golpea el servidor de un cliente.

Para el cron hay que agregar `'POST:/api/audit/run'` a `allowedApiRoutes` en `utils/verifyUser.ts`.
Es la única línea que este módulo toca de un archivo compartido del backend.

Cualquier bloque con `source: 'dataforseo'` es **superadmin, nunca por cron, y la respuesta lleva el
costo**. Es la regla fija de `Seo-Admin-Central`: nada automático ni periódico con APIs pagadas.

Contratos tipados en `utils/audit/types.ts`, referenciados desde `types.d.ts` con
`import('./utils/audit/types')`, igual que hoy se hace con `KeywordStats` y `KeywordScrapeSettings`.

Del lado cliente, un `services/audit.ts` con hooks de react-query v3, copiando el patrón de
`services/usage.ts`.

---

## 4. UI

### 4.1 Dónde van las donas — decisión que necesito de Fabián

Lo que pediste es "debajo de lo que ya existe en la pantalla del dominio". Tengo que marcar un problema
antes de que lo construyamos: en `/domain/[slug]`, `KeywordsTable` es una lista **virtualizada** cuya
altura es `window.innerHeight − 400`. Ocupa toda la pantalla a propósito. Cualquier cosa debajo queda
permanentemente bajo el pliegue, con dos scrolls compitiendo, y obliga a tocar el componente más
delicado de la aplicación.

Tres caminos:

| | Qué es | A favor | En contra |
|---|---|---|---|
| **A (recomendada)** | Pestaña nueva **"Auditoría"** en `DomainHeader`, junto a Tracking / Discover / Insight / Ideas. Página nueva `pages/domain/audit/[slug]/index.tsx` copiando el esqueleto de la de Insight. | **El diff sobre la pantalla de tracking es cero.** Cumple la restricción de forma literal. Un clic de distancia, igual que Insight. Único archivo compartido tocado: 5 líneas en `DomainHeader.tsx`. | No está "debajo" literalmente. |
| **B** | Franja de donas dentro de `/domain/[slug]`. | Es literal lo que pediste. | Toca la pantalla intocable, empuja la tabla, dos scrolls. |
| **C (fase 2)** | Franja delgada de resumen (~90 px, 8 donas chicas) **arriba** de la tabla en tracking, que enlaza a la pestaña. | Se ve sin scrollear y no rompe la tabla. | Solo tiene sentido cuando ya haya datos en los que confiar. |

Recomiendo **A ahora, C más adelante**. Pero es tu decisión, no la mía.

### 4.2 Qué se reusa (nada se reinventa)

| Necesidad | Se reusa |
|---|---|
| Esqueleto de página | `pages/domain/insight/[slug]/index.tsx` — TopBar + Sidebar + DomainHeader + contenido, con `guardPage(ctx, { slugParam: 'slug' })` |
| Sparkline de tendencia del bloque | `components/common/ChartSlim.tsx` tal cual, con `reverse={false}` y `noMaxLimit` (más puntaje es mejor) — para eso existen esas props |
| Gráfico grande del histórico de un check | `components/common/Chart.tsx` |
| Panel de detalle de un check | `components/common/SidePanel.tsx` (el mismo que usa `KeywordDetails`, con Escape y clic fuera ya resueltos) |
| Barra de filtros | El patrón visual de `components/keywords/KeywordFilter.tsx` |
| Iconos por bloque | `Icon.tsx` ya tiene `settings`, `link`, `link-alt`, `domains`, `edit`, `keywords`, `research`, `city` — alcanza para los 8 bloques |
| Colores | `utils/client/chartColors.ts` |
| Hooks de datos | Patrón de `services/usage.ts` |

**Un componente nuevo:** `components/common/DonutScore.tsx`, calcado de `ChartSlim.tsx` (se registra a sí
mismo, tamaño fijo, sin animación). Necesita `ChartJS.register(ArcElement, Tooltip)`. chart.js 3.9 y
react-chartjs-2 4.3 ya están instalados: **sin dependencia nueva.**

**Qué NO se reusa a propósito:** `react-window` en la lista de checks. Son ~26 filas, no 47.000.
Virtualizar ahí es complejidad sin beneficio.

### 4.3 Pantalla de detalle de un bloque

1. **Encabezado:** dona grande + puntaje + variación contra la corrida anterior (con la misma regla de
   `PositionChange`: si falta una de las dos puntas, se muestra dirección sin número) + sparkline.
2. **Barra de filtros:** estado (todo / falla / aviso / ok) · prioridad · fuente.
3. **Lista de checks**, una fila cada uno: estado (color) · título · prioridad · afectadas/total ·
   variación contra la corrida anterior.
4. **Clic en un check → `SidePanel`** con exactamente las columnas que pediste: qué revisa · cómo se
   comprueba · herramienta · prioridad · estado · recomendación. Más: la **tabla de evidencia** (las
   URLs afectadas, clicables) y el **gráfico histórico** del check.
5. Pie: "Última auditoría: <fecha> · 300 de 1.591 URLs revisadas · 4 min 12 s · USD 0,00".

---

## 5. Fases de entrega

Cada fase es un ticket POLO con su ID, respaldo previo y OK explícito. Cada una se despliega y se
verifica sola. Nada de big bang.

| Fase | Qué entrega | Cómo se verifica | Riesgo |
|---|---|---|---|
| **0. WAL** | `PRAGMA journal_mode=WAL` + `busy_timeout=5000` al abrir la conexión. Sin tablas nuevas, sin UI. | Un scrape manual y la UI abierta al mismo tiempo, sin `SQLITE_BUSY`. Mejora el sistema actual aunque el módulo no exista. | Bajo. Aparecen `-wal`/`-shm` en el volumen. Reversible. |
| **0b. Índices** | Verificar en producción si `keyword_daily` tiene su índice único. Declarar `@Index` en los modelos para que `db.sync()` también los cree. | `PRAGMA index_list('keyword_daily')` en el VPS. | Bajo, pero **es un bug pre-existente**: sin ese índice, `recordDailySnapshot` puede duplicar filas. |
| **1. Cimientos** | Migración de las 4 tablas + `domain.audit_settings`, modelos, `GET /api/audit`, pestaña "Auditoría" vacía. | La pestaña carga y dice "sin auditorías todavía". `git diff` sobre `/domain/[slug]` = vacío. Migración probada contra copia de la base real, como en el ticket del historial diario. | Bajo. Solo agrega. |
| **2. Crawler + Técnico** | Motor con límites duros + 10 checks técnicos. **Solo bajo demanda, sin cron.** | Correr sobre goaraucania.cl (4 URLs), después ammo.cl (17). Recién con eso probado, mavae. Verificar que el presupuesto se respeta y que la corrida se corta sola. | Medio. Es donde vive el riesgo de recursos. Por eso mavae va al final. |
| **3. On-Page + pantalla de detalle** | 10 checks on-page + pantalla de bloque + SidePanel de check. | La pantalla muestra evidencia real y clicable. | Bajo. |
| **4. Arquitectura + enlazado interno** | Grafo de enlaces (profundidad, inlinks, huérfanas) + 6 checks. | Contra ammo.cl, comparando con lo que se ve a mano. | Medio: el grafo obliga a crawlear siguiendo enlaces, no solo el sitemap. |
| **5. Cron semanal + tendencias** | El cron diario que decide qué toca + gráficos de evolución. | Dos semanas de corridas y un gráfico con dos puntos reales. | Bajo, pero **hasta acá el módulo no es "continuo"**. |
| **6. Contenido + Local** | Lo automatizable de esos bloques; el resto como `manual`. | — | Bajo. |
| **7. PageSpeed** | Core Web Vitals sobre una muestra. **Requiere resolver antes lo de la API key** (ver §6). | — | Bajo. |
| **8. Backlinks** | Solo bajo demanda, superadmin, con costo visible. Decisión aparte. | — | Bajo técnicamente, **es una decisión de plata**. |

El primer valor real llega en la **fase 2**: 10 checks técnicos con evidencia, sobre sitios reales.

---

## 6. Riesgos técnicos y deuda

### Dónde se puede romper lo existente

1. **SQLite sin WAL** — el riesgo número uno. Un segundo escritor pesado sobre `journal_mode = delete`
   produce `SQLITE_BUSY` y, en el peor caso, una posición del scrape que no se guarda. Se ataca en la
   fase 0, antes de cualquier otra cosa.
2. **`db.sync()` vs. migraciones** — `sync()` crea tablas faltantes sin índices; la migración después
   ve la tabla y se salta el bloque completo, `addIndex` incluidos. Las tablas nuevas tienen que
   declarar sus índices también en el modelo (`@Index`), y la migración debe verificar índices, no
   solo la existencia de la tabla. **Y hay que ir a mirar si `keyword_daily` ya está afectado.**
3. **Event loop compartido** — cheerio parsea de forma síncrona. Una página de 350 KB bloquea ~100 ms.
   Con concurrencia 2 y 500 ms de pausa está diluido, pero es la razón de fondo para que la auditoría
   nunca corra en la misma ventana que el scrape.
4. **Memoria del VPS** — quedan ~1,7-2,0 GB libres para tres aplicaciones más Dokploy, con 2 GB de swap.
   Un crawl con concurrencia 2 y cuerpos en streaming agrega ~60-80 MB en el pico. Es asumible, pero
   después del incidente de OOM del 21-ago va en el ticket con la línea de margen restante del sistema,
   como corresponde.
5. **Crawlear el sitio de un cliente** — genera carga real y aparece en su analítica. UA propio
   (`PoloRankBot/1.0 (+https://polorank.emignia.com)`), `robots.txt` respetado, 500 ms entre
   peticiones. mavae y ammo están en WordPress compartido: 300 peticiones en ráfaga podrían gatillar
   el límite del hosting. Si un WAF nos bloquea, la auditoría dice **"bloqueado"**, jamás un "falla"
   inventado.
6. **Falsos veredictos** — el riesgo de producto más grande, tratado en §2.6.

### Límites de SQLite acá

- Un solo escritor a la vez, siempre. WAL lo hace tolerable, no lo elimina.
- No hay tipos JSON nativos ni `json_extract` disponible vía Sequelize acá: la evidencia se guarda como
  TEXT y se filtra en Node. Con estos volúmenes es irrelevante.
- `ALTER TABLE` es limitado: agregar columnas sí, cambiar tipos no. Otra razón para que la
  configuración por dominio sea un JSON.
- No se achica al borrar; `VACUUM` bloquea todo. Manual, nunca automático.
- **Dónde deja de servir:** con ~50 dominios y crawls de 2.000 páginas semanales serían ~500.000
  filas/año en `audit_page`. Ahí toca Postgres. Con 5 dominios estamos tres órdenes de magnitud lejos.

### Deuda que se hereda y este módulo NO va a arreglar (pero conviene tener anotada)

- `writeFile('result.txt')` de depuración en el camino de scraping (`utils/scraper.ts:~355`).
- `axios-retry` declarado en `package.json` y jamás importado.
- `failed_queue.json` se lee y escribe entero sin lock: dos refrescos concurrentes se pisan.
- `refreshAndUpdateKeywords` se llama sin `await` ni `.catch()` en tres lugares → posible unhandled
  rejection y keywords con `updating: true` colgado si el proceso muere.
- `purgeOldCodes()` dice que la llama el cron diario y no tiene ningún llamador.
- `cron.js` lee `settings.json` una sola vez al arrancar.

Ninguna se toca en este módulo. Cada una es su propio ticket si Fabián quiere.

---

## 7. Costo operativo

| Recurso | Estimación | Contra qué |
|---|---|---|
| **Tiempo de reloj** | 3-5 min por auditoría de mavae (300 páginas, concurrencia 2, 500 ms); < 1 min los otros cuatro. ~20 min/semana en total. | Ventana de 05:00 UTC, vacía. |
| **CPU real** | ~10-15 s de parseo por auditoría completa. < 2 min/semana. | Despreciable. |
| **RAM pico** | +60-80 MB durante el crawl. | ~1,7-2,0 GB libres + 2 GB swap. |
| **Red** | ~75 MB por auditoría de mavae, < 20 MB los otros cuatro juntos. ~400 MB/mes. | Despreciable. |
| **Disco** | ~20-25 MB el primer año, con poda de `audit_page` en régimen. | 23 GB libres. |
| **Plata (fases 0-7)** | **USD 0,00.** Crawl propio, GSC ya integrado, PageSpeed gratis. | — |
| **Plata (fase 8, backlinks)** | ~USD 0,02 + 0,00003/resultado por consulta. 5 dominios × 1 vez al mes ≈ **USD 0,15/mes**. Apagado por defecto. | Decisión aparte, con el costo informado como manda `Seo-Admin-Central`. |

**El costo que no aparece en ninguna tabla:** tu atención. 80 checks × 5 dominios = 400 veredictos por
corrida. Si un 30% sale en amarillo, son 120 avisos que nadie va a leer y el módulo se vuelve ruido.
Ese es el argumento central del punto siguiente.

---

## 8. Mi recomendación sobre el alcance — 60-80 checks es demasiado para empezar

Te lo digo derecho: sí, es demasiado. Cuatro razones concretas.

**1. De los 8 bloques, solo 4 son automatizables de verdad con fuentes gratuitas.**

| Bloque | ¿Se puede verificar solo? | Realidad |
|---|---|---|
| Técnico | **Sí, completo** | robots, sitemap, https, códigos de estado, canonical, noindex. Determinista. |
| On-Page | **Sí, completo** | title, meta, H1, jerarquía, alt, schema. Determinista. |
| Arquitectura | **Sí**, con grafo de enlaces | cobertura de sitemap, huérfanas, profundidad. |
| Enlazado interno | **Sí**, con grafo de enlaces | inlinks, anchors, profundidad. |
| Contenido | **A medias** | Se mide extensión, duplicados, frescura. **La calidad no se mide.** |
| Local | **A medias** | Schema LocalBusiness y NAP en el HTML sí. Google Business Profile **no hay acceso configurado**. |
| Backlinks | **No sin pagar** | Requiere DataForSEO, y la regla es que nada pagado corre periódico. |
| Estrategia | **No** | ICP, plan de contenidos, prioridades: es criterio, no medición. Como checklist manual, bien; como puntaje automático, es inventar. |

**2. Un check sin regla determinista es una opinión disfrazada de medición.** Este proyecto ya pagó eso
dos veces en una semana: la constante `101` daba números plausibles y falsos, y el cruce de volúmenes
con mayúsculas devolvía 0 en silencio para dos dominios enteros. Con 80 checks, la probabilidad de que
varios sean heurísticas sin fundamento es alta, y un veredicto SEO equivocado que Fabián le muestra a
un cliente cuesta más que un casillero vacío.

**3. El valor está en la tendencia, y la tendencia necesita corridas.** Con auditoría semanal, el
primer gráfico que dice algo llega en 5-6 semanas. Prefiero 26 checks con seis semanas de historia
que 80 con una foto.

**4. Cada check nuevo cuesta casi nada, por diseño.** El catálogo está pensado para que agregar uno sea
un objeto en un arreglo. No hay ninguna ventaja en definirlos todos ahora: es exactamente el trabajo
que se puede diferir sin costo.

### Lo que propongo para empezar: 26 checks, todos gratuitos y deterministas

**Bloque Técnico (10) — fase 2**

| id | Qué revisa | Cómo se comprueba | Prioridad |
|---|---|---|---|
| `tec.robots.exists` | `robots.txt` responde 200 y no bloquea el sitio entero | GET `/robots.txt` | Crítica |
| `tec.sitemap.declared` | El `robots.txt` declara el sitemap y ese sitemap responde 200 | GET | Alta |
| `tec.sitemap.valid` | El sitemap es XML válido y sus URLs pertenecen al dominio | Parseo | Alta |
| `tec.https.forced` | `http://` redirige 301 a `https://` | Petición a http | Crítica |
| `tec.https.mixed` | Ninguna página carga recursos por `http://` | Búsqueda en el HTML | Alta |
| `tec.status.errors` | URLs del sitemap que devuelven 4xx/5xx | Código de estado | Crítica |
| `tec.redirect.chains` | Redirecciones de más de un salto | Seguir la cadena | Media |
| `tec.canonical.selfref` | Cada página tiene canonical y apunta a sí misma | Parseo del `<head>` | Alta |
| `tec.noindex.unintended` | Páginas del sitemap marcadas `noindex` | meta robots + `X-Robots-Tag` | Crítica |
| `tec.host.canonical` | `www` y sin `www` no responden ambos 200 | 2 peticiones | Alta |

**Bloque On-Page (10) — fase 3**

| id | Qué revisa | Prioridad |
|---|---|---|
| `onp.title.missing` | Páginas sin `title` | Crítica |
| `onp.title.length` | `title` fuera de 30-60 caracteres | Media |
| `onp.title.duplicate` | `title` repetidos entre páginas | Alta |
| `onp.meta.missing` | Páginas sin meta description | Media |
| `onp.meta.duplicate` | Meta descriptions repetidas | Media |
| `onp.h1.count` | Páginas sin H1 o con más de uno | Alta |
| `onp.heading.hierarchy` | Saltos de nivel (H1 → H3) | Baja |
| `onp.img.alt` | Imágenes sin `alt` | Media |
| `onp.schema.present` | La página declara datos estructurados (JSON-LD) | Media |
| `onp.target.title` | **La URL objetivo de una keyword lleva esa keyword en el title** | Alta |

**Bloque Arquitectura (6) — fase 4**

| id | Qué revisa | Prioridad |
|---|---|---|
| `arq.target.reachable` | **Toda `keyword.target_url` responde 200, sin redirección, y es indexable** | Crítica |
| `arq.sitemap.coverage` | URLs alcanzables por enlaces que no están en el sitemap | Alta |
| `arq.orphan.pages` | URLs del sitemap sin ningún enlace interno entrante | Alta |
| `arq.depth` | Páginas a más de 3 clics de la home | Media |
| `arq.gsc.uncrawled` | Páginas con clics en GSC que el crawl no alcanzó | Media |
| `arq.url.format` | URLs con mayúsculas, guiones bajos o parámetros | Baja |

**Los dos que más valor tienen son los que unen la auditoría con el tracking**, y son los que ninguna
herramienta comprada puede hacer, porque nadie más sabe cuál es la landing que debería rankear:
`arq.target.reachable` y `onp.target.title`. El primero, solo, habría detectado automáticamente el
problema de mavae del 25 de agosto —diez URL objetivo que redirigían a la home y que hubo que revisar a
mano una por una— sin que nadie tuviera que mirarlas.

### Lo que necesito de ti

1. **Nombrá los 5 checks que realmente vas a accionar este mes.** Esos van primero, sin importar el
   bloque. El catálogo se ordena por lo que se usa, no por lo que se puede medir.
2. **Decidí dónde van las donas** (§4.1: pestaña nueva / dentro de tracking / híbrido).
3. **Decidí la frecuencia** (recomiendo semanal, no diaria).
4. **Confirmá si el intervalo lo decide el endpoint o el cron** (§2.3 — es una desviación deliberada del
   patrón vigente y prefiero que la apruebes explícitamente).
5. **Backlinks: ¿entra o no?** Es el único bloque con costo y contradice la regla de "nada periódico con
   APIs pagadas". Mi recomendación es dejarlo fuera del automático y ofrecerlo como botón manual mucho
   más adelante.

### Un dato que hay que corregir antes de la fase 7

`CLAUDE.md` dice que la **API key de PageSpeed Insights está configurada**. Busqué en
`Empresas/Google-Admin-Central/` y **no existe ninguna key**: el README la menciona en una tabla de
capacidades y en una lista de "próximas integraciones", pero no hay archivo ni script que la use. La
API v5 funciona sin key con un límite bajo de peticiones, que para 5 dominios semanales probablemente
alcanza, pero conviene saberlo antes de prometer Core Web Vitals. Lo dejo anotado en vez de asumirlo.
