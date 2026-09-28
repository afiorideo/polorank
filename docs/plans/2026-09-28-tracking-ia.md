# Tracking IA — plan de implementación

**Objetivo:** pestaña nueva que muestra, para las mismas keywords que ya se siguen, si el dominio
aparece citado en el resumen con IA de Google.

**Arquitectura:** el bloque `ai_overview` ya viene en la respuesta de SERP que se paga hoy. Se extrae
con una función pura, se guarda en tres columnas nuevas de `keyword_daily` dentro del flujo diario
existente, y se lee desde una pestaña de solo lectura calcada de Tracking.

**Stack:** Next 12 Pages Router · SQLite + Sequelize · Jest · Tailwind 3

**Spec:** `docs/specs/2026-09-28-tracking-ia-diseno.md`

## Restricciones globales

- **Costo operativo cero.** Ninguna consulta nueva a ninguna API. Todo sale del scrape actual.
- **No romper el tracking.** La captura va envuelta en su propio manejo de errores: un fallo leyendo
  las referencias no puede tumbar la actualización de posición.
- **Tres estados, nunca dos.** `1` citado · `0` no citado · `-1` no hubo resumen. Un bloque que no se
  pudo leer es `-1`, jamás `0`.
- **Sin datos hacia atrás.** Las filas anteriores al despliegue quedan en `-1`.
- ESLint `max-len` 150, indentación de 3 espacios, todo el texto de interfaz en español.
- Material de prueba sin costo: `respaldos/aio-madera-de-roble.json` (respuesta real con `ai_overview`).

---

### Tarea 1 — Extractor de referencias

**Archivos:**
- Modificar: `scrapers/services/dataforseo.ts`
- Test: `__tests__/scrapers/dataforseo-ai.test.ts`

**Interfaces:**
- Produce: `extractAiOverview(content: unknown): AiOverview | null` donde
  `AiOverview = { text: string, references: AiReference[] }` y
  `AiReference = { position: number, source: string, domain: string, url: string, title: string }`
- Produce: `citedPosition(refs: AiReference[], domain: string): number` → puesto (1-based) o `0`

- [ ] **Paso 1:** escribir los tests contra el JSON real guardado: devuelve 6 referencias, encuentra
      `sodimac.cl` en el puesto 1, devuelve `null` cuando no hay bloque `ai_overview`, devuelve `null`
      cuando `asynchronous_ai_overview` es `true`, y compara dominios ignorando `www` y mayúsculas.
- [ ] **Paso 2:** correr y verificar que fallan.
- [ ] **Paso 3:** implementar las dos funciones. `extractAiOverview` busca el item de tipo
      `ai_overview`; si no está, o si `asynchronous_ai_overview` es `true`, devuelve `null`.
- [ ] **Paso 4:** correr los tests, lint y `tsc`.
- [ ] **Paso 5:** commit.

---

### Tarea 2 — Migración

**Archivos:**
- Crear: `database/migrations/1787600000006-add-ai-overview-to-keyword-daily.js`
- Modificar: `database/models/keywordDaily.ts`

**Interfaces:**
- Produce: columnas `ai_cited` (INTEGER, default `-1`), `ai_references` (TEXT, default `'[]'`),
  `ai_text` (TEXT, default `''`) en `keyword_daily`.

- [ ] **Paso 1:** escribir la migración siguiendo el patrón de `1787600000004`: `addColumn` dentro de
      transacción, con `describeTable` para que sea reejecutable, y `down` que las quita.
- [ ] **Paso 2:** agregar las tres columnas al modelo, con comentario explicando que `-1` significa
      "no hubo resumen" y por qué no es lo mismo que `0`.
- [ ] **Paso 3:** probar contra una copia consistente de producción (los tres archivos, con WAL):
      `db:migrate`, verificar columnas y que las 59 keywords / 1.658 filas diarias siguen intactas,
      `db:migrate:undo`, verificar de nuevo.
- [ ] **Paso 4:** commit.

---

### Tarea 3 — Captura en el flujo diario

**Archivos:**
- Modificar: `utils/audit/../dailySnapshot.ts` → `utils/dailySnapshot.ts`
- Modificar: `utils/refresh.ts`
- Modificar: `utils/scraper.ts` (pasar la respuesta cruda al snapshot)
- Test: `__tests__/utils/dailySnapshot.test.ts` (ampliar)

**Interfaces:**
- Consume: `extractAiOverview`, `citedPosition` de la Tarea 1
- Produce: `DailySnapshot` gana `aiCited: number`, `aiReferences: AiReference[]`, `aiText: string`

- [ ] **Paso 1:** tests: `recordDailySnapshot` guarda `ai_cited = 1` con las referencias cuando el
      dominio está citado, `0` cuando hay resumen y no está, `-1` cuando no hay resumen, y **nunca
      lanza** si el extractor falla.
- [ ] **Paso 2:** correr y verificar que fallan.
- [ ] **Paso 3:** implementar. El cálculo del estado vive en el snapshot, no en el scraper.
- [ ] **Paso 4:** tests, lint, `tsc`, y la suite completa para confirmar que los 200 anteriores siguen
      pasando.
- [ ] **Paso 5:** commit.

---

### Tarea 4 — API de lectura

**Archivos:**
- Crear: `pages/api/ai-tracking.ts`
- Crear: `utils/aiTracking.ts` (agregación de períodos)
- Test: `__tests__/utils/aiTracking.test.ts`

**Interfaces:**
- Produce: `GET /api/ai-tracking?domain=` → `{ rows: AiRow[] }` donde
  `AiRow = { keywordID, keyword, volume, cited: 1|0|-1, position: number, citedUrl: string,
  periods: { d7: Ratio, d30: Ratio, d60: Ratio, d90: Ratio } }` y `Ratio = { cited: number, chances: number } | null`
- Produce: `citationRatio(rows: {date, ai_cited}[], days: number, now: Date): Ratio | null`

- [ ] **Paso 1:** tests de `citationRatio`: cuenta oportunidades (`ai_cited !== -1`) como denominador y
      citas como numerador; devuelve `null` cuando no hubo ninguna oportunidad en el período; ignora los
      días fuera del rango.
- [ ] **Paso 2:** correr y verificar que fallan.
- [ ] **Paso 3:** implementar la función pura y el endpoint, que autentica igual que `/api/keywords`.
- [ ] **Paso 4:** tests, lint, `tsc`.
- [ ] **Paso 5:** commit.

---

### Tarea 5 — Pestaña y panel

**Archivos:**
- Crear: `pages/ai-tracking/[slug]/index.tsx`
- Crear: `components/aitracking/AiTrackingTable.tsx`
- Crear: `components/aitracking/AiCitedBadge.tsx`
- Crear: `components/aitracking/AiDetailPanel.tsx`
- Crear: `services/aiTracking.tsx`
- Modificar: `components/domains/DomainHeader.tsx` (pestaña a la derecha de Tracking)

**Interfaces:**
- Consume: `GET /api/ai-tracking` de la Tarea 4

- [ ] **Paso 1:** tests de `AiCitedBadge`: `✓ Sí` en verde, `✗ No` en rojo, `— N/A` en gris, y que el
      gris tenga un título que explique que no hubo resumen con IA.
- [ ] **Paso 2:** correr y verificar que fallan.
- [ ] **Paso 3:** implementar la insignia, la tabla (columnas: Keyword · Vol. · ¿Te cita? · Puesto ·
      URL citada · 7d · 30d · 60d · 90d), el panel lateral que cruza las fuentes contra el top orgánico
      guardado en `serp_top`, y la pestaña en el encabezado del dominio.
- [ ] **Paso 4:** tests, lint, `tsc`, `next build`.
- [ ] **Paso 5:** commit.

---

### Tarea 6 — Despliegue

- [ ] **Paso 1:** respaldo de `/app/data` antes del despliegue.
- [ ] **Paso 2:** fila en `docs/REGISTRO-DE-CAMBIOS.md` con ticket `POLO-2026-09-28-01`.
- [ ] **Paso 3:** push y **esperar a que el contenedor nuevo esté arriba** antes de informar.
- [ ] **Paso 4:** verificar que la migración se aplicó y que las 59 keywords siguen intactas.
- [ ] **Paso 5:** **NO refrescar ninguna keyword.** Fabián lo hace manualmente. Avisarle que la tabla
      se ve vacía (`— N/A` en todo) hasta el primer scrape, y que un refresco manual cuesta ~USD 0,002.
