# PoloRank — Diseño aprobado (spec)

**Fecha:** 2026-08-24
**Proyecto:** `Laboratorio/polo-rank/` → producción en `polorank.emignia.com`
**Base:** fork de [SerpBear](https://github.com/towfiqi/serpbear) v3.1.0
**Decide:** Fabián · **Diseña y ejecuta:** Claude (rol `fullstack-architect-nextjs`, con `backend-systems-engineer` y `frontend-ux-nextjs`)

---

## 1. Resumen del sistema

PoloRank es un fork de SerpBear con cuatro cambios funcionales:

1. **Conector DataForSEO** como proveedor de posiciones (modo live), con registro de costo por consulta.
2. **Vista Tracking estilo DinoRank**: cambios a 30/60/90 días, evolución, snippets de la SERP, URL posicionada, filtros subiendo/bajando y Top 10/20, panel lateral con historial mensual.
3. **Marca PoloRank** con paleta Emignia, tema claro y oscuro.
4. **Acceso por código al correo** (sin contraseña) con tres roles y gestión de usuarios.

Todo lo demás de SerpBear se conserva sin cambios: cron diario, cola de reintentos, notificaciones por correo, Search Console (Discover/Insight), Ideas (Google Ads), tags, exportar CSV, configuración global y por dominio.

---

## 2. Decisiones tomadas (registro)

| # | Decisión | Elegido |
|---|---|---|
| D1 | Base técnica | **Fork y modificar sobre el stack de SerpBear** (no reescribir en Next 16) |
| D2 | Modo DataForSEO | **Live** (síncrono, igual al flujo actual de SerpBear) |
| D3 | Lógica de páginas/profundidad | **Igual a SerpBear**: basic / custom / smart + full fallback, configurable **global y por dominio**. ~~Sin override por keyword~~ → **Actualizado 2026-08-24 (POLO-2026-08-25-01): se agregó override por keyword** (keyword → dominio → global). Sin lógica nueva de costos |
| D4 | Modelo de usuarios | **Tres roles**: superadmin (todo), admin de dominio (ver + agregar/quitar keywords), usuario de dominio (solo ver). **Un solo dominio** por admin/usuario de dominio |
| D5 | Refresco manual de posiciones | **Solo superadmin** |
| D6 | Datos actuales | **Migrar la base SQLite** de SerpBear. SerpBear sigue operativo hasta validar PoloRank. **Cero cruce** (contenedor, base, dominio y cron propios) |
| D12 | Hosting | **VPS #1 Hetzner (web, `91.99.66.186`)** — Dokploy enfocado en apps web. SerpBear queda en el VPS #2 (automation) hasta su apagado |
| D7 | Columnas del tracking | **Opción B híbrida**: DinoRank + Mejor + Search Console (Pos/Impr/Clics) |
| D8 | Tema oscuro | **Emignia profundo** (`#080812` / `#0D0D1E`), no morado pleno |
| D9 | Historial de keyword | **Panel lateral** (no fila expandible) |
| D10 | Logo | `PoloRank2.png` (cara del perro), fondo transparente; wordmark con tipografía y gradiente Emignia |
| D11 | Panel de consumo | Sí, en admin: resumen, por dominio y por usuario. **Sin tope mensual** por ahora |

---

## 3. Stack e infraestructura

**Stack heredado de SerpBear, versiones sin cambiar:** Next.js 12.3 (Pages Router), React 18.2, TypeScript 4.8, Tailwind 3.4, SQLite + Sequelize 6 (`sequelize-typescript`, migraciones con `sequelize-cli`), `croner` (cron interno), `nodemailer` (correo), Jest (pruebas).

> Desviación del playbook Emignia (Next 16 / Tailwind 4) por decisión D1. Se documenta en `Empresas/EMIGNIA/PLAYBOOK-Web-NextJS/` como excepción con su porqué.

- **Repositorio:** `github.com/afiorideo/polorank` (fork con historial de SerpBear, para poder traer arreglos a mano).
- **Deploy:** Dokploy en **VPS #1 Hetzner "web"** (`91.99.66.186`, junto a emignia.com y MyDress; ver `System/SSH-SERVERS.md`), app `polorank`, build desde el `Dockerfile` de SerpBear (Node 22 alpine, standalone), volumen propio montado en `/app/data` con `polorank.sqlite`. Dominio `polorank.emignia.com` vía Cloudflare (proxy) → Traefik de Dokploy. Impacto de recursos: ~170 MiB sobre 2,0 GB disponibles hoy → margen restante ~1,8 GB + 2 GB swap.
- **Cron:** el `cron.js` interno del contenedor, igual que SerpBear (scrape diario, notificaciones, reintentos, Search Console).
- **Correo de acceso y notificaciones:** SMTP Zoho `hola@emignia.com` (mismo de MyDress), por variables de entorno.

### Variables de entorno

| Variable | Uso |
|---|---|
| `SECRET` | firma del JWT de sesión |
| `APIKEY` | llamadas internas del cron (`/api/cron`, `/api/notify`, `/api/refresh`) |
| `SESSION_DURATION` | duración de sesión en horas (**720** = 30 días) |
| `NEXT_PUBLIC_APP_URL` | `https://polorank.emignia.com` |
| `ADMIN_EMAIL` | correo del superadmin sembrado (`afiorid@gmail.com`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | envío del código de acceso |

Se eliminan `USER` y `PASSWORD` de SerpBear. Las credenciales de DataForSEO **no** van en env: se cargan desde Configuración → Scraper (campo cifrado con `cryptr`, como hoy cualquier API de scraper).

---

## 4. Módulos

| # | Módulo | Responsabilidad | Depende de |
|---|---|---|---|
| M1 | **Base** | Fork, renombrado del paquete, entorno local corriendo con **copia** de la base actual, pipeline de migraciones verificado | — |
| M2 | **Conector DataForSEO** | Extensión del marco de scrapers a POST, scraper `dataforseo`, tabla `api_usage`, columna `serp_features` | M1 |
| M5 | **Acceso y usuarios** | Código al correo, sesión JWT con rol, tablas `user`/`login_code`, guardas por rol en todos los endpoints, pantalla Usuarios | M1 |
| M3 | **Tracking** | Tabla híbrida, filtros, deltas 30/60/90, snippets, panel lateral con meses | M2 (features), M5 (qué ve cada rol) |
| M4 | **Marca y temas** | Logo, tipografía, tokens Emignia, claro/oscuro, pantalla de acceso, renombrado de textos | M3 |
| M7 | **Panel de consumo** | Pantalla Configuración → Consumo (resumen, por dominio, por usuario), saldo DataForSEO, CSV | M2, M5 |
| M6 | **Producción** | Deploy Dokploy, DNS, migración real de la base, validación, apagado posterior de SerpBear | todos |

Orden de construcción: **M1 → M2 → M5 → M3 → M4 → M7 → M6.**

---

## 5. Modelo de datos

Se conservan `domain`, `keyword` y `settings` de SerpBear. Cambios vía migraciones `sequelize-cli` (carpeta `database/migrations/`), reversibles.

### 5.1 Tablas nuevas

**`user`**

| Campo | Tipo | Notas |
|---|---|---|
| `ID` | integer PK autoincrement | |
| `email` | string, único, en minúsculas | |
| `role` | `'superadmin' \| 'domain_admin' \| 'domain_user'` | |
| `domain_id` | integer FK → `domain.ID`, nullable | **obligatorio** salvo superadmin; **un solo dominio** |
| `active` | boolean, default true | desactivar sin borrar |
| `created_at` | datetime | |
| `last_login` | datetime nullable | |

Al arrancar, si no existe el correo de `ADMIN_EMAIL`, se crea como superadmin activo. Ese registro no se puede borrar, desactivar ni degradar desde la interfaz.

**`login_code`**

| Campo | Tipo | Notas |
|---|---|---|
| `ID` | integer PK | |
| `email` | string | |
| `code_hash` | string | SHA-256 del código de 6 dígitos + `SECRET`; nunca se guarda en claro |
| `expires_at` | datetime | 10 minutos |
| `attempts` | integer, default 0 | máx. 5; al superarlo el código queda inválido |
| `used` | boolean | un código se usa una sola vez |
| `created_at` | datetime | |

Límite: máximo 5 códigos generados por correo por hora. Los códigos vencidos se limpian en el cron diario.

**`api_usage`**

| Campo | Tipo | Notas |
|---|---|---|
| `ID` | integer PK | |
| `created_at` | datetime | |
| `domain` | string | dominio de la keyword |
| `keyword_id` | integer | |
| `keyword` | string | copia del texto, para que el registro sobreviva si se borra la keyword |
| `depth` | integer | profundidad pedida (10, 20, … 100) |
| `cost_usd` | decimal(10,6) | costo real informado por DataForSEO en la respuesta |
| `triggered_by` | string | `'cron'` o el `user.ID` que apretó refrescar |
| `status` | `'ok' \| 'error'` | |

### 5.2 Columna nueva en `keyword`

- `serp_features` (string JSON, default `[]`): tipos de bloque presentes en la SERP en la última consulta, normalizados: `featured_snippet`, `people_also_ask`, `local_pack` (mapa), `video`, `images`, `shopping`, `ai_overview`, `knowledge_graph`. Solo se guardan los que DataForSEO devuelva; no se infieren.

### 5.3 Datos que ya existen y se reutilizan

- `keyword.history` (JSON `{ "YYYY-M-D": posición }`, un punto por día) → alimenta deltas 30/60/90, sparkline, gráfico y resumen mensual. **No se agregan consultas para esto.**
- `keyword.lastResult` (top resultados de la última SERP) → panel lateral.
- `domain.search_console` + tablas de Search Console → columnas Pos GSC / Impresiones / Clics (como hoy).

---

## 6. Acceso y permisos (M5)

### 6.1 Flujo de acceso

1. `/login`: el usuario escribe su correo → `POST /api/auth/request { email }`.
   - Si el correo existe y está activo: se genera un código de 6 dígitos, se guarda el hash, se envía por SMTP ("Tu código de acceso a PoloRank: 123456. Vence en 10 minutos").
   - Si no existe o está inactivo: **misma respuesta** que si existiera ("Si el correo está autorizado, te llegará un código") — no se revela si un correo está registrado.
2. Segunda pantalla: código de 6 dígitos → `POST /api/auth/verify { email, code }`.
   - Correcto → cookie `token` httpOnly con JWT `{ uid, email, role, domainId }`, duración `SESSION_DURATION`; se marca el código como usado y se actualiza `last_login`.
   - Incorrecto → `attempts + 1`; mensajes: "Código incorrecto o vencido" / "Demasiados intentos, pide un código nuevo".
3. "Reenviar código" y "Cambiar correo" como en MyDress. `POST /api/logout` borra la cookie.

Se mantiene el acceso por `APIKEY` (header `Authorization: Bearer`) **solo** para las rutas internas del cron, como hoy.

### 6.2 Matriz de permisos (se aplica en el servidor)

| Acción | superadmin | domain_admin | domain_user |
|---|---|---|---|
| Ver tracking, historial, panel lateral, exportar CSV | todos los dominios | su dominio | su dominio |
| Ver Discover / Insight / Ideas | ✔ | su dominio | su dominio |
| Agregar / quitar keywords, editar tags | ✔ | su dominio | ✖ |
| Refrescar posiciones a mano (`/api/refresh`) | ✔ | ✖ | ✖ |
| Crear / editar / borrar dominios, config del dominio, Search Console del dominio | ✔ | ✖ | ✖ |
| Configuración global (scraper, SMTP, cron, notificaciones) | ✔ | ✖ | ✖ |
| Usuarios y Consumo | ✔ | ✖ | ✖ |

Implementación: `utils/verifyUser.ts` pasa a devolver `{ authorized, user }` (decodificando el JWT). Cada handler en `pages/api/*` llama a una guarda `requireRole(...)` y, cuando la ruta recibe `domain`/`slug`/`id` de keyword, `requireDomainAccess(user, domain)`. Las páginas (`getServerSideProps`) redirigen a `/login` sin sesión y a `/domain/<su-dominio>` si un usuario de dominio intenta entrar a otro o a Configuración. La barra lateral muestra solo los dominios permitidos y esconde botones según rol (la guarda real está en el servidor).

### 6.3 Pantalla Configuración → Usuarios (superadmin)

Lista (correo, rol, dominio, activo, último acceso) + formulario: correo, rol, dominio (selector obligatorio si el rol no es superadmin; **uno solo**). Acciones: activar/desactivar, cambiar rol o dominio, eliminar. Al crear un usuario no se envía nada: la persona pide su código en el login. Endpoints: `GET/POST /api/users`, `PUT/DELETE /api/users/[id]`.

---

## 7. Conector DataForSEO (M2)

### 7.1 Extensión del marco de scrapers

Hoy `utils/scraper.ts → scrapeSinglePage` hace siempre `fetch(url, { method: 'GET', headers })`. Se agregan a `ScraperSettings` (en `types.d.ts`) dos campos opcionales:

- `method?: 'GET' | 'POST'` (default `'GET'`)
- `body?(keyword, settings, countries, pagination): string` — cuerpo JSON para POST.

Y `scrapeSinglePage` los respeta. Los 11 scrapers existentes no cambian.

### 7.2 Scraper `scrapers/services/dataforseo.ts`

- `id: 'dataforseo'`, `name: 'DataForSEO'`, `allowsCity: true`, `method: 'POST'`, **`depthBased: true`** (flag nuevo). Ojo: no se usa el flag existente `nativePagination`, porque en `scrapeKeywordWithStrategy` ese flag **salta la resolución de estrategia** y siempre pide 100. Con `depthBased`, el flujo resuelve la estrategia (global/dominio) como siempre, calcula el `depth` (tabla 7.3) y hace **una sola llamada** con `pagination = { start: 0, num: depth }`; el full fallback hace la segunda llamada a 100 solo si no encontró el dominio.
- Endpoint: `POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced`.
- Headers: `Authorization: Basic base64(login:password)` — login/password desde `settings.scaping_api` con formato `login:password` (mismo campo que usan los demás scrapers), `Content-Type: application/json`.
- Cuerpo (un solo task):
  ```json
  [{
    "keyword": "<keyword>",
    "location_code": <código país o ciudad>,
    "language_code": "<idioma>",
    "device": "desktop" | "mobile",
    "os": "windows" | "android",
    "depth": <10..100>
  }]
  ```
  País → `location_code` (Chile 2152, Brasil 2076, Uruguay 2858, USA 2840; tabla completa en `utils/countries.ts` ampliada con el código DataForSEO). Idioma → el idioma que SerpBear ya asocia al país. Ciudad → `location_name: "Ciudad,País"` en lugar de `location_code`.
- Extractor: recorre `tasks[0].result[0].items`; los de `type: "organic"` dan `{ position: rank_absolute, url, title }`; los demás tipos alimentan `serp_features`. El `cost` de la respuesta se registra en `api_usage`.

### 7.3 Traducción de la estrategia → `depth` (sin lógica nueva)

| Estrategia SerpBear (global o por dominio) | `depth` |
|---|---|
| `basic` | 10 |
| `custom` N páginas | N × 10 |
| `smart`, keyword con posición P conocida | `(ceil(P/10) + 1) × 10`, tope 100 — de la página 1 a la siguiente de donde estaba (pos. 2 → 20, pos. 46 → 60) |
| `smart`, keyword nueva (P = 0) | 10 (igual que SerpBear: solo página 1) |
| `smart` + full fallback, no encontrada | segunda llamada con `depth` 100 |

Nota: DataForSEO no permite saltar páginas, por eso `smart` pide desde la 1. Para keywords en Top 20 cuesta igual o menos que SerpBear; para keywords profundas cuesta más bloques (pos. 46: 6 bloques vs. 3). Costo: **USD 0,002 por cada 10 resultados** (verificado en `Seo-Admin-Central` 2026-08-23/24).

### 7.4 Errores

- HTTP ≠ 200, `status_code` ≠ 20000 o task con error → `lastUpdateError` con el mensaje, reintento por la cola de fallidos de SerpBear, fila `api_usage` con `status: 'error'` y el costo que informe la respuesta (si lo hay).
- Saldo agotado (código 40201/40202 de DataForSEO) → además, aviso persistente en Configuración → Scraper y en Consumo.

---

## 8. Tracking (M3)

### 8.1 Tabla (vista de dominio, pestaña Tracking)

Columnas, en este orden:

1. **Evol.** — sparkline de los últimos 30 días (componente `ChartSlim` existente).
2. **Keyword** — texto, bandera del país, dispositivo, tags.
3. **Vol.** — volumen (dato existente).
4. **Posición** — número con semáforo (1–10 verde, 11–20 ámbar, 21+ rojo, fuera del top gris) y flecha de cambio según "Comparar con".
5. **30d · 60d · 90d** — cambio de posición vs. hace N días (`pos_hace_N − pos_hoy`; positivo = mejoró, verde; negativo = rojo; sin dato = "—"), con la posición de ese día entre paréntesis. Se toma el punto de `history` más cercano a la fecha objetivo dentro de ±3 días; si no hay, "—".
6. **Snippets** — iconos según `serp_features` (★ fragmento destacado, ? otras preguntas, 📍 mapa, ▶ video, 🖼 imágenes, 🛍 shopping, ✦ AI overview); apagados si no están.
7. **URL posicionada** — enlace a la URL que rankea.
8. **Mejor** — mejor posición histórica (mínimo de `history`).
9. **Pos GSC · Impresiones · Clics** — columnas de Search Console existentes (visibles solo si el dominio tiene Search Console conectado).

Fuera del top: se muestra **"+N"** donde N es la profundidad pedida en la última consulta (por ejemplo "+100"), nunca "0". Todas las columnas ordenables; el selector de columnas visibles de SerpBear se mantiene.

### 8.2 Filtros (barra superior)

- Todas / **Subiendo** / **Bajando** (según el cambio de la columna Posición).
- Todas / **Top 10** / **Top 20**.
- Desktop / Mobile (existente).
- **Comparar con:** 7 / 30 / 60 / 90 días → gobierna la flecha de la columna Posición y el filtro subiendo/bajando.
- País, tags, buscador, orden (existentes).

Todo se calcula en el navegador con los datos que `/api/keywords` ya entrega (el `history` viene completo). Sin endpoints nuevos.

### 8.3 Panel lateral de keyword (reemplaza `KeywordDetails`)

- Cabecera: keyword, país, dispositivo, dominio, fecha de alta, URL actual.
- Rango: 30 días / 90 días / 6 meses / 12 meses / todo.
- Indicadores: posición hoy · mejor (con fecha) · promedio del rango · cambio vs. inicio del rango.
- Gráfico de línea del rango (componente `Chart` existente, eje invertido: 1 arriba).
- **Tabla por mes**: mes, mejor, promedio, peor, cambio vs. mes anterior (por promedio), URL posicionada más frecuente del mes. Calculada desde `history`; los meses sin datos no aparecen.
- Top resultados de la última SERP (`lastResult`, existente).

---

## 9. Marca y temas (M4)

- **Logo:** `assets/polo-face.png` (cara con fondo transparente, ya generado desde `PoloRank2.png`). Wordmark "PoloRank" en **Space Grotesk 700** con gradiente `linear-gradient(135deg, #6C63FF, #3B82F6, #00E5FF)`. Favicon y `apple-touch-icon` con la cara.
- **Tipografía:** Inter (cuerpo), Space Grotesk (títulos), vía `next/font` o `<link>` a Google Fonts (Next 12 admite ambos).
- **Tokens (Tailwind 3, `darkMode: 'class'`):**

| Token | Claro | Oscuro |
|---|---|---|
| fondo app | `#F4F4FA` | `#080812` |
| tarjetas / barra lateral | `#FFFFFF` | `#0D0D1E` |
| cabecera de tabla | `#FAFAFE` | `#12122A` |
| borde | `#E2E8F0` | `#2A2A4A` |
| texto | `#1A1A2E` | `#F0F0F6` |
| texto secundario | `#64748B` | `#94A3B8` |
| acento / botón primario | `#6C63FF` (hover `#5550E0`) | `#6C63FF` (texto-enlace `#8B85FF`) |
| selección | `#EEEEFC` / `#5550E0` | `#1E1B4B` / `#A5A0FF` |
| semáforo verde / ámbar / rojo | `#DCFCE7`·`#15803D` / `#FEF3C7`·`#B45309` / `#FEE2E2`·`#B91C1C` | `#0F3D2E`·`#34D399` / `#3F2A0A`·`#FBBF24` / `#3F1212`·`#F87171` |

- **Cambio de tema:** botón sol/luna en la barra lateral; preferencia en `localStorage`; sin preferencia, sigue al sistema (`prefers-color-scheme`). Sin parpadeo al cargar (script inline en `_document.tsx` que aplica la clase antes del render).
- **Pantalla de acceso:** logo centrado, dos pasos (correo → código), textos en español de Chile.
- **Renombrado:** "SerpBear" → "PoloRank" en títulos, `package.json`, correos de notificación (`email/`), textos de la interfaz y `README`. Créditos a SerpBear (licencia MIT) se conservan en el README y en el pie de página.

---

## 10. Panel de consumo (M7, superadmin)

Pantalla Configuración → **Consumo**, con filtro de período (mes actual / mes anterior / rango de fechas) y exportar CSV.

1. **Resumen:** llamadas y costo del período, mes anterior, **proyección a fin de mes** (promedio diario del mes × días del mes) y **saldo actual de DataForSEO** (`GET /v3/appendix/user_data`, sin costo; se consulta al abrir la pantalla).
2. **Por dominio:** dominio, keywords activas, llamadas, costo del período, costo acumulado.
3. **Por usuario:** correo, rol, dominio, costo del período (= costo de su dominio) y, aparte, costo de los refrescos manuales que originó. El superadmin aparece con el total general y sus refrescos manuales.

Endpoint: `GET /api/usage?from=&to=` → agregados desde `api_usage` (solo superadmin). **Sin tope mensual ni alertas** (decisión D11).

---

## 11. Migración y salida a producción (M6)

1. **Copia** del `data/serpbear.sqlite` desde el volumen del contenedor `automation-serpbear-*` (SSH al VPS #2) → se usa desde M1 en local.
2. Deploy en Dokploy del **VPS #1** (app `polorank`), variables de entorno, volumen, dominio `polorank.emignia.com` en Cloudflare.
3. Migración real: copia fresca de la base de SerpBear ese día (VPS #2 → local → VPS #1 por `scp`) → volumen de PoloRank → `sequelize-cli db:migrate` (lo hace el `entrypoint.sh`) → siembra del superadmin.
4. Configurar DataForSEO en Configuración → Scraper y correr un refresco manual de prueba (2–3 keywords; costo en centavos, informado).
5. Validación de Fabián. Mientras tanto SerpBear sigue vivo con su propio scraper; ambos actualizan a diario por separado (cada uno paga a su proveedor).
6. Apagado de SerpBear: cambio con ID, respaldo de su base y OK explícito (ley de cambios).

---

## 12. Pruebas y verificación

- **Jest (existente):** se agregan pruebas para (a) extractor DataForSEO con respuestas reales guardadas como fixture, (b) traducción estrategia → `depth`, (c) cálculo de deltas 30/60/90 y resumen mensual desde un `history` de ejemplo, (d) guardas de rol: un `domain_admin` no puede leer ni escribir en otro dominio ni llamar a `/api/refresh`; un `domain_user` no puede agregar keywords; nadie sin sesión accede a nada.
- **Radiografía de entrada** en el primer test real del conector: se revisa el cuerpo exacto enviado a DataForSEO y la respuesta cruda antes de dar por bueno el mapeo.
- **QA visual** de ambos temas (claro y oscuro) en desktop y móvil antes de entregar cada módulo de frontend.
- Cada módulo se entrega para revisión antes de pasar al siguiente. Los pasos que tocan servicios reales (DataForSEO, VPS, DNS) requieren OK explícito previo.

---

## 13. Fuera de alcance (explícito)

- Override de estrategia/profundidad por keyword.
- Modo cola estándar de DataForSEO.
- Varios dominios por usuario; roles adicionales; autogestión de usuarios por admins de dominio.
- Tope mensual de gasto y alertas de consumo.
- Métrica "%SERP" de DinoRank (no se conoce su fórmula; no se inventa).
- Mapa de keywords, competencia, informes PDF de DinoRank.
- Migrar a Next 16 / Tailwind 4.

---

## 14. Estructura del repo (cambios sobre SerpBear)

```
polorank/
├── assets/brand/                 # logo, favicon, wordmark
├── database/
│   ├── migrations/               # + user, login_code, api_usage, keyword.serp_features
│   └── models/                   # + user.ts, loginCode.ts, apiUsage.ts
├── scrapers/services/
│   └── dataforseo.ts             # nuevo
├── utils/
│   ├── scraper.ts                # soporte method/body (POST)
│   ├── verifyUser.ts             # devuelve usuario + rol; guardas requireRole / requireDomainAccess
│   ├── auth/                     # generación/envío/verificación de códigos
│   ├── usage.ts                  # registro y agregados de api_usage
│   └── history.ts                # deltas 30/60/90, resumen mensual (puro, testeable)
├── pages/api/
│   ├── auth/request.ts, auth/verify.ts
│   ├── users.ts, users/[id].ts
│   └── usage.ts
├── pages/
│   ├── login.tsx                 # dos pasos
│   └── settings → pestañas Usuarios y Consumo
├── components/
│   ├── keywords/                 # KeywordsTable, Keyword, KeywordFilter, KeywordDetails (rediseñados)
│   ├── settings/Users.tsx, settings/Usage.tsx
│   └── common/ThemeToggle.tsx
├── tailwind.config.js            # tokens Emignia, darkMode: 'class'
└── docs/specs/                   # este archivo
```
