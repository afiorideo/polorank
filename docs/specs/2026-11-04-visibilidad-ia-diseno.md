# Visibilidad IA — diseño

**Fecha:** 2026-11-04 · **Estado:** borrador para aprobación de Fabián
**Reemplaza a:** la pestaña «Tracking IA» (`2026-09-28-tracking-ia-diseno.md`), que pasa a ser la vista «Google IA».
**Evidencia:** piloto `respaldos/piloto-ia-2026-11-04/` (24 respuestas reales) y prueba DataForSEO vs Serper
`respaldos/prueba-dfs-serper-2026-11-04/` (DFS 1/3 páginas normales, Serper 3/3; soporte de DataForSEO confirma
"poisoned SERPs" sin solución ni fecha).

---

## 1. Qué es

Una pestaña **«Visibilidad IA»** por dominio con dos vistas:

| Vista | Qué mide | Con qué se consulta | Fuente |
|---|---|---|---|
| **Asistentes IA** | Si ChatGPT, Gemini, Google AI Mode y Perplexity nombran / citan al negocio y a quién más recomiendan | **Prompts** (frases en lenguaje natural), 5 por dominio | DataForSEO AI Optimization + SERP AI Mode |
| **Google IA** | Si el resumen con IA de Google cita al dominio, Local Pack y "Otras preguntas" | **Palabras clave** que ya sigue PoloRank | DataForSEO SERP (página completa) |

**Las posiciones orgánicas siguen saliendo de Serper, a diario, sin cambios.** DataForSEO no se usa para
posiciones (páginas envenenadas).

**Todo se ejecuta una vez por semana** (lunes 06:00 hora Chile) **y a demanda** (botón).

## 2. Alcance

**Dentro (esta entrega):**
- Credenciales de DataForSEO para IA, separadas del proveedor de posiciones.
- Asistentes IA: prompts con etiquetas, corrida semanal y a demanda, tabla, detalle, competencia, fuentes, evolución.
- Google IA: corrida semanal propia, Local Pack, "Otras preguntas", marca de página "no confiable".
- Tope de gasto mensual y registro de costo de cada llamada.
- Carga inicial de los 30 prompts aprobados (6 dominios × 5).

**Fuera (etapas siguientes):** análisis "por qué no apareces" con IA, sugerencia automática de prompts,
tráfico desde IAs con GA4, Claude (caro: US$0,047 por llamada y coincidió con ChatGPT en el piloto).

## 3. Dominios y prompts iniciales

Se activa solo en: **ammo.cl, mavae.cl, maderasfresard.com, emignia.com, thetravellab.cl, thetravellab.com.br.**
Los 30 prompts son los aprobados por Fabián el 2026-11-04 (ver §12). Máximo **5 prompts por dominio**
(ajuste global `ai_max_prompts`, por defecto 5).

## 4. Datos

### 4.1 Ajustes globales (Settings → nueva sección "Visibilidad IA")
| Campo | Tipo | Por defecto | Uso |
|---|---|---|---|
| `ai_dataforseo_credentials` | `login:password` (cifrado igual que `scaping_api`) | vacío | Todas las llamadas de IA. Si está vacío, el módulo no corre |
| `ai_monthly_budget_usd` | número | 10 | Tope de gasto del módulo en el mes calendario |
| `ai_max_prompts` | entero | 5 | Prompts por dominio |
| `ai_weekly_enabled` | booleano | true | Corrida semanal automática |

`gotoCredentials()` también lee `ai_dataforseo_credentials` cuando el proveedor no es DataForSEO
(hoy usa la variable de entorno `DATAFORSEO_GOTO_CREDENTIALS`).

### 4.2 Por dominio (columnas nuevas en `domain`)
| Campo | Tipo | Ejemplo Ammo | Uso |
|---|---|---|---|
| `ai_enabled` | bool | true | Si el dominio entra en la corrida |
| `ai_brand_variants` | JSON string[] | `["Ammo","Ammo Store"]` | Nombres que cuentan como "te nombra" |
| `ai_brand_urls` | JSON string[] | `["ammo.cl","instagram.com/ammostorechile"]` | Fuentes que cuentan como "te cita" |
| `ai_competitors` | JSON `{name, variants[]}[]` | `Armario de la Karo`… | Conteo de competencia en todas las IAs |
| `ai_location_code` | int | 2152 | País para ChatGPT, AI Mode y Google IA (BR = 2076) |
| `ai_language_code` | string | `es` | Idioma (BR = `pt`) |
| `ai_gemini_location_code` | int, opcional | 20153 (Araucanía) | Gemini admite región; si vacío usa `ai_location_code` |
| `ai_country_iso` | string | `CL` | País de búsqueda web de Perplexity (BR = `BR`) |

### 4.3 Tablas nuevas
**`ai_prompt`** — `ID, domain, prompt (≤500 car.), tags (JSON), active, created_at` + override opcional por prompt `location_code, language_code, country_iso` (nulos = usa los del dominio; caso Emignia prompt 5, medido desde Brasil)

**`ai_run`** — una corrida (semanal o a demanda):
`ID, started_at, finished_at, triggered_by ('cron' | 'user:<ID>'), scope ('all' | 'domain:<d>' | 'prompt:<id>' | 'google:<d>'), status ('pending' | 'done' | 'partial' | 'skipped_budget'), est_cost_usd, cost_usd`

**`ai_answer`** — una respuesta de una IA:
| Campo | Detalle |
|---|---|
| `ID, run_id, prompt_id, domain, engine` | engine = `chatgpt` · `gemini` · `ai_mode` · `perplexity` |
| `rep` | 1, 2 o 3 |
| `week` | lunes de la semana ISO (`2026-11-10`), para agrupar |
| `task_id, status` | id de DataForSEO · `pending` · `ok` · `error` |
| `mentioned` | 1 / 0 (texto, variantes de marca, sin acentos ni mayúsculas) |
| `cited` | 1 / 0 (alguna fuente coincide con `ai_brand_urls`) |
| `position` | lugar de la marca entre las marcas detectadas, 0 si no está |
| `brands` | JSON, marcas detectadas en orden de aparición |
| `sources` | JSON `{domain, url, title}[]` (citadas + resultados de búsqueda) |
| `fan_out` | JSON, búsquedas internas de la IA (si las trae) |
| `text` | respuesta completa (markdown) |
| `raw` | respuesta completa de DataForSEO, comprimida (zlib + base64) |
| `cost_usd, created_at` | |

**Regla: se guarda todo lo que trae cada llamada.** `raw` permite extraer datos nuevos después sin volver a
pagar. Volumen estimado: 360 respuestas/semana × ~10 KB comprimido ≈ 3,6 MB/semana. `raw` se purga a las
**26 semanas**; los campos extraídos se conservan siempre.

### 4.4 Google IA (columnas nuevas en `keyword_daily`)
Se reutiliza `ai_cited`, `ai_mentioned`, `ai_references`, `ai_text` en la fila del día de la corrida. Nuevas:
- `local_pack` — JSON `{present, position, items:[{title, domain, rating}]}`
- `paa` — JSON string[] ("Otras preguntas de los usuarios")
- `serp_trust` — `1` confiable · `0` no confiable (envenenada) · `null` sin comparar

**Corrección de un efecto actual:** con Serper como proveedor, el refresco diario escribe `ai_cited = -1`
("no hubo resumen"), lo que es falso: no se midió. Desde ahora, si el proveedor no trae IA, los campos `ai_*`
quedan `null` = **no medido**. Migración: los días con refresco por Serper (según `api_usage.scraper`) pasan
de `-1` a `null`. Los cálculos de Tracking IA ya excluyen `-1`; deben excluir también `null`.

## 5. Corrida semanal

`cron.js` agrega `ai_weekly` = `0 0 9 * * 1` (lunes 09:00 UTC = 06:00 Chile) → `POST /api/ai-visibility/cron`.

1. **Presupuesto:** calcula el costo estimado (§8). Si `gasto del mes + estimado > ai_monthly_budget_usd`
   → `ai_run.status = skipped_budget`, aviso en el panel, no llama a nada.
2. **Asistentes IA**, por cada prompt activo × 3 repeticiones:
   - ChatGPT y Gemini → LLM Scraper **cola estándar** (`task_post`), US$0,0012 c/u.
   - AI Mode → SERP Google AI Mode cola estándar (`task_post`).
   - Perplexity → LLM Responses **live** (Sonar no admite cola), modelo `sonar`, US$0,006 c/u.
3. **Google IA**, por cada palabra clave del dominio: SERP Google Organic live advanced, mismos parámetros
   que el scraper de PoloRank (`device`, `location_code`, `language_code`, `depth: 10`).
4. **Recolección:** cron cada 10 min `POST /api/ai-visibility/collect` pide los `task_id` pendientes
   (`task_get`). Lo que siga pendiente después de 24 h queda `error`. La corrida pasa a `done` o `partial`.

Las llamadas en vivo se hacen con concurrencia máxima 5 (límite de DataForSEO: 30).

## 6. A demanda

Botón **"Actualizar ahora"** en tres alcances: un prompt, todos los prompts del dominio, Google IA del dominio.
- Usa **live** en todas las IAs (resultado en segundos, ~3× más caro en ChatGPT/Gemini).
- Antes de ejecutar muestra el costo estimado y pide confirmar. Respeta el tope mensual.
- El resultado reemplaza las respuestas de esa semana para ese alcance (una semana = un dato).

## 7. Análisis de cada respuesta

- **Texto:** ChatGPT/Gemini `markdown` · Perplexity `items[].sections[].text` · AI Mode `markdown` del ítem `ai_overview`
  (estructura a confirmar en la tarea 1).
- **Te nombra:** alguna variante de `ai_brand_variants` aparece en la prosa, normalizada con el mismo `flat()` de
  `utils/aiTracking.ts` (sin acentos: "AMMÔ Store" → `ammostore` contiene `ammo`). Mínimo 4 letras, como hoy.
- **Te cita:** alguna fuente (`sources`, `search_results`, anotaciones) coincide con `ai_brand_urls` por dominio o
  por prefijo de URL (`instagram.com/ammostorechile`).
- **Marcas y lugar:** ChatGPT trae `brand_entities` ordenadas → se usan tal cual. En las otras IAs, orden de la
  primera aparición en el texto de la marca propia y de cada competidor de `ai_competitors`.
  `position` = lugar de la marca propia en esa lista.
- **Competidores nuevos:** nombres de `brand_entities` de ChatGPT que no están en `ai_competitors` se muestran como
  "detectados" para que Fabián los agregue con un clic. No se agregan solos.

## 8. Costo

| Por corrida semanal (6 dominios, 30 prompts, 39 palabras clave) | Llamadas | US$ |
|---|---|---|
| ChatGPT (cola estándar, ×3) | 90 | 0,11 |
| Gemini (cola estándar, ×3) | 90 | 0,11 |
| AI Mode (×3) | 90 | ~0,18 *(a confirmar)* |
| Perplexity (live, ×3) | 90 | 0,54 |
| Google IA (+1 reintento si no confiable, estimado) | ~55 | ~0,11 |
| **Total por corrida** | **~415** | **~US$1,05** |
| **Al mes (4,33 semanas)** | | **~US$4,5** |

A demanda: **~US$0,05 por prompt** (4 IAs × 3, en vivo) · **~US$0,25 por dominio** · Google IA ~US$0,002 por palabra clave.

Cada llamada se registra en `api_usage` con `scraper = 'ai:<engine>'` y su costo real (`cost` de la respuesta),
para que salga en el panel "Consumo" existente.

## 9. Página no confiable (Google IA)

Después de cada consulta de Google IA se comparan los dominios del top 10 de DataForSEO con los del último
resultado de Serper de esa palabra clave (ya guardado, sin costo). Los resultados `google.com/goto` toman el
dominio de `breadcrumb`.
- Si **menos de la mitad** de los dominios de Serper aparecen en la página de DataForSEO → **no confiable**.
  Se reintenta **1 vez**. Si sigue igual, se guarda con `serp_trust = 0` y la fila muestra "no confiable";
  no cuenta en las tasas de citación.
- Validado con la prueba del 2026-11-04: dfs-1 y dfs-3 (envenenadas) quedan bajo 50%; dfs-2 (normal) sobre 90%.

## 10. Interfaz

Pestaña **«Visibilidad IA»** (reemplaza «Tracking IA», misma ruta `/ai-tracking/[slug]`), según la maqueta
aprobada `respaldos/piloto-ia-2026-11-04/maqueta-visibilidad-ia.html`:

**Asistentes IA**
- Cabecera: última medición, próxima, botones "Actualizar ahora" y "Prompts y competidores".
- Tarjetas: te nombran (X de N respuestas), te citan, lugar promedio, competidor principal.
- Por IA: "N de M prompts" con "X de Y respuestas" debajo.
- Filtro por etiquetas.
- Tabla de prompts: celda por IA "3/3 · #1"; más nombrados; variación contra la semana anterior. Al abrir: por IA,
  extracto, búsquedas internas, fuentes y enlace a las 3 respuestas completas.
- Competencia (veces nombrados por IA), fuentes más usadas por IA, evolución semanal (% de respuestas que te
  nombran, propio vs. competidor principal), filtrable por IA y etiqueta.

**Google IA** — la tabla actual del Tracking IA, con: columna Local Pack (posición o "—"), insignia "no confiable",
"Otras preguntas" en el detalle, y periodos en **semanas** (últimas 4 / 8 / 12) en vez de días.

**Configuración** (modal por dominio): prompts (alta, edición, baja, etiquetas, tope 5), variantes de marca, URLs
propias, competidores, país e idioma.

**Settings:** sección "Visibilidad IA" con los campos de §4.1 y el gasto del mes.

## 11. Errores

- Credenciales vacías o inválidas → el módulo no corre y el panel lo dice.
- Una llamada falla → `ai_answer.status = error`, la celda muestra "—" y no cuenta en las tasas. El resto sigue.
- DataForSEO caído en la corrida semanal → la corrida queda `partial`; se puede completar a demanda.
- Tope alcanzado → `skipped_budget` y aviso en el panel con el gasto del mes.

## 12. Prompts iniciales (aprobados 2026-11-04)

**ammo.cl** (CL, es; Gemini 20153)
1. ¿Qué tiendas en Temuco venden vestidos de fiesta bonitos y de buena calidad? — `venta`
2. ¿Dónde encuentro vestidos de gala en Temuco? — `gala`
3. ¿Dónde puedo arrendar un vestido de fiesta en Temuco? — `arriendo`
4. ¿Dónde compro un vestido para mi graduación en Temuco? — `graduación`
5. ¿Dónde encuentro un vestido para la fiesta de fin de año de mi empresa en Temuco? — `fin de año`

**mavae.cl** (CL, es)
1. ¿Qué empresas de regalos corporativos recomiendas en Chile? — `regalos corporativos`
2. ¿Dónde mando a hacer merchandising corporativo con el logo de mi empresa en Chile? — `merchandising`
3. ¿Qué proveedor hace bolsas personalizadas con logo en Chile? — `bolsas`
4. Necesito regalos corporativos personalizados para clientes, ¿qué empresa en Santiago me recomiendas? — `personalizados`
5. ¿Qué regalos corporativos de Navidad puedo dar a mis clientes y dónde los compro en Chile? — `navidad`

**maderasfresard.com** (CL, es)
1. ¿Dónde compro madera de roble en el sur de Chile? — `roble`
2. ¿Qué aserraderos venden maderas del sur de Chile al por mayor? — `mayorista`
3. ¿Dónde puedo comprar madera de raulí en Chile? — `raulí`
4. ¿Quién vende madera de coihue en la Araucanía? — `coihue`
5. ¿Dónde compro madera de pino oregón seca en Chile? — `pino oregón`

**emignia.com** (CL, es; el prompt 5 se mide desde BR, pt)
1. ¿Qué agencia SEO recomiendas en Chile? — `seo`
2. ¿Qué agencia de marketing digital en Chile me recomiendas para una pyme? — `marketing digital`
3. ¿Qué empresa recomiendas para hacer el diseño de la página web de mi empresa en Chile? — `diseño web`
4. ¿Qué agencia puede posicionar mi negocio en Google y en ChatGPT en Chile? — `seo ia`
5. Qual agência de SEO você recomenda para minha empresa? — `brasil`

→ Requiere país/idioma **por prompt** opcional (override del dominio): `ai_prompt.location_code`,
`ai_prompt.language_code`, `ai_prompt.country_iso`, todos nulos por defecto.

**thetravellab.cl** (CL, es)
1. ¿Qué agencia de viajes en Chile recomiendas para comprar un paquete a Brasil? — `brasil`
2. ¿Dónde compro un paquete a Río de Janeiro desde Chile con vuelo y hotel? — `rio`
3. ¿Qué agencia de viajes en Chile es confiable para viajar al extranjero? — `agencia`
4. ¿Dónde encuentro paquetes a Florianópolis desde Santiago? — `florianópolis`
5. Quiero ir a Brasil en verano con mi familia, ¿qué agencia en Chile me arma el viaje? — `familia`

**thetravellab.com.br** (BR 2076, pt, Perplexity BR)
1. Qual agência de viagem você recomenda para uma viagem para o Chile? — `chile`
2. Onde compro um pacote de viagem para o Chile com hotel e passeios? — `pacote`
3. Qual agência vende pacote para Santiago do Chile saindo do Brasil? — `santiago`
4. Vale a pena conhecer Pucón no Chile? Qual agência organiza a viagem? — `pucón`
5. Quero viajar para o Chile com minha família, qual agência monta o roteiro? — `família`

## 13. Pruebas

Con las respuestas reales del piloto como fixtures (`crudo/*.json`) y de la prueba DFS vs Serper:
- Parser por IA (texto, fuentes, fan-out, brand_entities).
- "Te nombra" con "AMMÔ Store" y "Ammô Store" → 1. "Te cita" con `instagram.com/ammostorechile` → 1.
- Lugar: ChatGPT venta #1 → Ammo #2 detrás de Armario de la Karo.
- Página no confiable: dfs-1 y dfs-3 → 0; dfs-2 → 1.
- Tope de gasto: estimado que excede → `skipped_budget` sin llamadas.
- Migración `-1 → null` y que las tasas ignoren `null`.

## 14. Entrega por etapas (cada una se publica con OK de Fabián)

1. **Base:** credenciales IA en Settings, columnas y tablas, migración `-1 → null`, verificación de AI Mode
   (1 llamada) y de la cola estándar de Gemini.
2. **Google IA semanal:** corrida, Local Pack, "Otras preguntas", página no confiable, tabla en semanas.
3. **Asistentes IA backend:** corrida semanal + recolección + a demanda + análisis + carga de los 30 prompts.
4. **Asistentes IA interfaz:** pestaña según maqueta + configuración.
