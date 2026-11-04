# Visibilidad IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pestaña «Visibilidad IA» en PoloRank: medición semanal y a demanda de ChatGPT, Gemini, Google AI Mode y Perplexity (prompts) y del resumen con IA de Google (palabras clave), todo vía DataForSEO, con encendido gradual (solo ammo.cl al inicio).

**Architecture:** Módulo nuevo `utils/aiVisibility/` (cliente DataForSEO, motores, análisis, confianza, presupuesto, corredor) + 3 modelos (`ai_prompt`, `ai_run`, `ai_answer`) + columnas nuevas en `domain` y `keyword_daily`. Cron semanal (lunes 09:00 UTC) y recolector cada 10 min llaman a rutas API protegidas por `APIKEY`, igual que `/api/cron` y `/api/audit/cron`. Las posiciones siguen con Serper sin cambios.

**Tech Stack:** Next 12 Pages Router · TypeScript · sequelize-typescript + SQLite · sequelize-cli migrations · croner · react-query · Tailwind · Jest + jest-fetch-mock.

**Spec:** `docs/specs/2026-11-04-visibilidad-ia-diseno.md` (leerlo completo antes de empezar).

## Global Constraints

- Todo texto de interfaz en **español**.
- Posiciones orgánicas: **no tocar** el flujo de Serper. DataForSEO solo para IA.
- Credenciales IA: setting `ai_dataforseo_credentials`, formato `login:password`, **cifrado con `cryptr` igual que `scaping_api`**.
- Cada llamada a DataForSEO se registra con `logUsage()` (`utils/usage.ts`), `scraper = 'ai:<engine>'`, costo real de la respuesta (`cost`).
- Presupuesto: `ai_monthly_budget_usd` por defecto **2**; si `gasto del mes + estimado > tope` → no se llama a nada.
- Encendido gradual: `ai_settings.enabled = true` **solo en ammo.cl** al terminar; los otros 5 dominios quedan cargados y apagados.
- Máximo de prompts por dominio: `ai_max_prompts`, por defecto **5**.
- 3 repeticiones por prompt y motor. Semana = lunes ISO (`YYYY-MM-DD`).
- Estados de IA en `keyword_daily.ai_cited/ai_mentioned`: `1`, `0`, `-1` (no hubo resumen), `-2` (diferido), **`-3` (no medido, nuevo)**. Los negativos no cuentan en las tasas.
- Migraciones: patrón de `database/migrations/1787600000007-add-ai-mentioned.js` (transacción, `describeTable` antes de `addColumn`, `down` que no recrea tablas SQLite).
- No hacer `git push` (publica a producción). Commits locales por tarea; el push lo autoriza Fabián por etapa.
- Correr pruebas con: `npx jest --ci <ruta>`.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/1787600000009-ai-visibility.js` | Columnas `domain.ai_settings`, `keyword_daily.local_pack/paa/serp_trust`, tablas `ai_prompt/ai_run/ai_answer`, `-1 → -3` en días medidos por Serper |
| `database/migrations/1787600000010-seed-ai-prompts.js` | Carga los 30 prompts y `ai_settings` de los 6 dominios (solo Ammo encendido) |
| `database/models/aiPrompt.ts`, `aiRun.ts`, `aiAnswer.ts` | Modelos |
| `utils/aiVisibility/config.ts` | Tipo `AiDomainSettings`, `parseAiSettings`, `targetFor` |
| `utils/aiVisibility/dfs.ts` | `dfsPost`, `dfsGet` (Basic auth, timeout, costo) |
| `utils/aiVisibility/engines.ts` | Por motor: endpoints, `buildTask`, `parseResult` → `ParsedAnswer` |
| `utils/aiVisibility/analyze.ts` | `analyzeAnswer` → mencionado / citado / lugar / marcas |
| `utils/aiVisibility/trust.ts` | `serpTrust` (página envenenada) |
| `utils/aiVisibility/budget.ts` | `monthSpend`, `estimateCost`, `PRICES` |
| `utils/aiVisibility/week.ts` | `weekOf(date)` |
| `utils/aiVisibility/googleIa.ts` | Corrida Google IA de un dominio |
| `utils/aiVisibility/runner.ts` | `startRun`, `collectPending`, `runLive` |
| `pages/api/ai-visibility/cron.ts`, `collect.ts`, `run.ts`, `prompts.ts`, `config.ts`, `data.ts` | Rutas |
| `services/aiVisibility.tsx` | Hooks react-query |
| `components/aivisibility/*` | Interfaz de Asistentes IA y configuración |
| Modificar: `utils/dailySnapshot.ts`, `utils/refresh.ts`, `utils/aiTracking.ts`, `utils/gotoResolver.ts`, `pages/api/settings.ts`, `types.d.ts`, `cron.js`, `pages/api/ai-tracking.ts`, `components/aitracking/AiTrackingTable.tsx`, `components/domains/DomainHeader.tsx`, `pages/ai-tracking/[slug]/index.tsx`, `components/settings/ScraperSettings.tsx`, `database/database.ts`, `database/models/domain.ts`, `database/models/keywordDaily.ts` | |

Fixtures: copiar a `__tests__/fixtures/ai/` desde `../respaldos/piloto-ia-2026-11-04/crudo/` los archivos `chatgpt-venta-1.json`, `gemini-arriendo-1.json`, `claude-venta-1.json`, `perplexity-venta-1.json`, y desde `../respaldos/prueba-dfs-serper-2026-11-04/` los archivos `dfs-1.json`, `dfs-2.json`, `serper-1.json`.

---

# ETAPA 1 — Base

### Task 1: Verificar AI Mode y cola estándar (llamadas reales, ~US$0,01)

**Files:**
- Create: `scripts/verify-ai-endpoints.js` (no se publica en la interfaz; queda como herramienta)
- Create: `__tests__/fixtures/ai/ai-mode-ammo.json`, `__tests__/fixtures/ai/gemini-task-get.json`

**Interfaces:** Produce los fixtures que usan las Tasks 6 y 11.

- [ ] **Step 1: Escribir el script**

```js
// node scripts/verify-ai-endpoints.js "login:password"
// 1) AI Mode live  2) Gemini LLM Scraper task_post + espera + task_get. Imprime costo y estructura.
const fs = require('fs');
const [login, password] = (process.argv[2] || '').split(/:(.+)/);
const auth = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
const call = async (method, path, body) => {
   const r = await fetch(`https://api.dataforseo.com/v3${path}`, {
      method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
   });
   return r.json();
};
(async () => {
   const q = '¿Dónde puedo arrendar un vestido de fiesta en Temuco?';
   const live = await call('POST', '/serp/google/ai_mode/live/advanced', [{ keyword: q, location_code: 2152, language_code: 'es', device: 'mobile' }]);
   fs.writeFileSync('__tests__/fixtures/ai/ai-mode-ammo.json', JSON.stringify(live, null, 1));
   const t = live.tasks[0];
   console.log('AI MODE live', t.status_code, t.status_message, 'cost', live.cost);
   const r = (t.result || [])[0] || {};
   console.log('  item types:', (r.items || []).map((i) => i.type), 'keys:', Object.keys((r.items || [])[0] || {}));
   const post = await call('POST', '/ai_optimization/gemini/llm_scraper/task_post', [{ keyword: q, location_code: 20153, language_code: 'es' }]);
   const id = post.tasks[0].id;
   console.log('GEMINI task_post', post.tasks[0].status_code, 'cost', post.cost, 'id', id);
   for (let i = 0; i < 40; i += 1) {
      await new Promise((ok) => setTimeout(ok, 15000));
      const got = await call('GET', `/ai_optimization/gemini/llm_scraper/task_get/advanced/${id}`);
      const g = got.tasks[0];
      console.log(`  intento ${i + 1}:`, g.status_code, g.status_message);
      if (g.status_code === 20000) { fs.writeFileSync('__tests__/fixtures/ai/gemini-task-get.json', JSON.stringify(got, null, 1)); break; }
   }
})();
```

- [ ] **Step 2: Ejecutar** con las credenciales de `Empresas/Seo-Admin-Central/seo-credentials.yaml`:
`node scripts/verify-ai-endpoints.js "<login>:<password>"`

Expected: AI Mode `20000` con costo (anotarlo); Gemini `20100` al crear y `20000` en algún intento.
**Si AI Mode no responde 20000 o su costo supera US$0,005:** detenerse y avisar a Fabián (decide si se quita AI Mode). Registrar los costos en `Empresas/Seo-Admin-Central/registro-consumo.csv` (fila manual, cliente `PoloRank-verificacion`).

- [ ] **Step 3: Anotar la estructura** en el encabezado de `utils/aiVisibility/engines.ts` (Task 6): tipo de ítem de AI Mode que trae el texto (esperado `ai_overview`, con `markdown` y `references[]`) y el tiempo que tardó la cola estándar.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-ai-endpoints.js __tests__/fixtures/ai/
git commit -m "POLO-2026-11-04 (1): verificación AI Mode y cola estándar + fixtures"
```

### Task 2: Migración, modelos y estado «no medido»

**Files:**
- Create: `database/migrations/1787600000009-ai-visibility.js`
- Create: `database/models/aiPrompt.ts`, `database/models/aiRun.ts`, `database/models/aiAnswer.ts`
- Modify: `database/database.ts` (registrar modelos), `database/models/domain.ts` (`ai_settings`), `database/models/keywordDaily.ts` (`local_pack`, `paa`, `serp_trust`), `utils/aiTracking.ts` (`AI_NOT_MEASURED`, exportar `flat`)
- Test: `__tests__/utils/aiTrackingStates.test.ts`

**Interfaces:**
- Produces: `AI_NOT_MEASURED = -3`; `flat(text: string): string` exportado de `utils/aiTracking.ts`; modelos `AiPrompt`, `AiRun`, `AiAnswer`.

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import { AI_NOT_MEASURED, citationRatio, flat } from '../../utils/aiTracking';

describe('estado no medido', () => {
   it('vale -3 y no cuenta como oportunidad', () => {
      expect(AI_NOT_MEASURED).toBe(-3);
      const now = new Date(2026, 10, 30);
      const rows = Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${i + 1}`, ai_cited: i < 2 ? 1 : AI_NOT_MEASURED }));
      const r = citationRatio(rows, 30, now);
      expect(r && r.withAi).toBe(2);
      expect(r && r.cited).toBe(2);
   });
   it('flat quita acentos: AMMÔ Store → ammostore', () => {
      expect(flat('AMMÔ Store')).toBe('ammostore');
   });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiTrackingStates.test.ts` → FAIL (`AI_NOT_MEASURED` no existe).

- [ ] **Step 3: Implementar en `utils/aiTracking.ts`**

Debajo de `export const AI_DEFERRED = -2;`:
```ts
/** -3: no se midió (el proveedor de ese día no trae IA, p. ej. Serper). Distinto de -1 "no hubo resumen". */
export const AI_NOT_MEASURED = -3;
```
Cambiar `const flat = (text: string): string =>` por `export const flat = (text: string): string =>`.
(`citationRatio` ya filtra `cited >= 0`, así que -3 queda fuera sin más cambios.)

- [ ] **Step 4: Modelos.** `database/models/aiPrompt.ts`:

```ts
import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — un prompt (frase en lenguaje natural) que se pregunta a las IAs. */
@Table({ timestamps: false, tableName: 'ai_prompt' })
class AiPrompt extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   domain!: string;

   @Column({ type: DataType.STRING(500), allowNull: false })
   prompt!: string;

   /** JSON string[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' })
   tags!: string;

   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
   active!: boolean;

   /** Override por prompt; null = usa el del dominio. */
   @Column({ type: DataType.INTEGER, allowNull: true })
   location_code!: number | null;

   @Column({ type: DataType.STRING, allowNull: true })
   language_code!: string | null;

   @Column({ type: DataType.STRING, allowNull: true })
   country_iso!: string | null;

   @Column({ type: DataType.STRING, allowNull: false })
   created_at!: string;
}

export default AiPrompt;
```

`database/models/aiRun.ts`:
```ts
import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — una corrida de Visibilidad IA (semanal o a demanda). */
@Table({ timestamps: false, tableName: 'ai_run' })
class AiRun extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   started_at!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   finished_at!: string | null;

   /** 'cron' | 'user:<ID>' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'cron' })
   triggered_by!: string;

   /** 'all' | 'domain:<d>' | 'prompt:<id>' | 'google:<d>' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'all' })
   scope!: string;

   /** 'pending' | 'done' | 'partial' | 'skipped_budget' | 'skipped_no_credentials' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' })
   status!: string;

   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 })
   est_cost_usd!: number;

   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 })
   cost_usd!: number;
}

export default AiRun;
```

`database/models/aiAnswer.ts`:
```ts
import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — una respuesta de una IA a un prompt (una repetición). */
@Table({ timestamps: false, tableName: 'ai_answer' })
class AiAnswer extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false }) run_id!: number;
   @Column({ type: DataType.INTEGER, allowNull: false }) prompt_id!: number;
   @Column({ type: DataType.STRING, allowNull: false }) domain!: string;
   /** 'chatgpt' | 'gemini' | 'ai_mode' | 'perplexity' */
   @Column({ type: DataType.STRING, allowNull: false }) engine!: string;
   @Column({ type: DataType.INTEGER, allowNull: false }) rep!: number;
   /** Lunes de la semana ISO, 'YYYY-MM-DD' */
   @Column({ type: DataType.STRING, allowNull: false }) week!: string;
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' }) task_id!: string;
   /** 'pending' | 'ok' | 'error' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' }) status!: string;
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) mentioned!: number;
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) cited!: number;
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) position!: number;
   /** JSON string[] en orden de aparición */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' }) brands!: string;
   /** JSON {domain,url,title}[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' }) sources!: string;
   /** JSON string[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' }) fan_out!: string;
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' }) text!: string;
   /** Respuesta completa de DataForSEO: zlib + base64. Se purga a las 26 semanas. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' }) raw!: string;
   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 }) cost_usd!: number;
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' }) error!: string;
   @Column({ type: DataType.STRING, allowNull: false }) created_at!: string;
}

export default AiAnswer;
```

En `database/models/domain.ts`, después de `subdomain_matching`:
```ts
   /** PoloRank — Visibilidad IA: JSON AiDomainSettings (utils/aiVisibility/config.ts). */
   @Column({ type: DataType.TEXT, allowNull: true, defaultValue: '{}' })
   ai_settings!: string;
```
En `database/models/keywordDaily.ts`, al final de las columnas:
```ts
   /** Google IA: {present, position, items:[{title, domain, rating}]} */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '{}' })
   local_pack!: string;

   /** Google IA: "Otras preguntas de los usuarios", JSON string[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' })
   paa!: string;

   /** Google IA: 1 página confiable · 0 envenenada · null sin comparar */
   @Column({ type: DataType.INTEGER, allowNull: true })
   serp_trust!: number | null;
```
En `database/database.ts`: importar `AiPrompt`, `AiRun`, `AiAnswer` y agregarlos al arreglo `models`.

- [ ] **Step 5: Migración** `database/migrations/1787600000009-ai-visibility.js`:

```js
// PoloRank migration: Visibilidad IA (spec 2026-11-04).
// 1) domain.ai_settings · 2) keyword_daily.local_pack/paa/serp_trust · 3) tablas ai_prompt/ai_run/ai_answer
// 4) Los días refrescados por un proveedor SIN IA (Serper) guardaron ai_cited = -1 ("no hubo resumen"), que es
//    falso: no se midió. Se pasan a -3 (no medido). Se identifican por api_usage.scraper del mismo día y keyword.
module.exports = {
   up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async (t) => {
      const T = Sequelize.DataTypes;
      const dom = await queryInterface.describeTable('domain');
      if (!dom.ai_settings) {
         await queryInterface.addColumn('domain', 'ai_settings', { type: T.TEXT, allowNull: true, defaultValue: '{}' }, { transaction: t });
      }
      const kd = await queryInterface.describeTable('keyword_daily');
      if (!kd.local_pack) { await queryInterface.addColumn('keyword_daily', 'local_pack', { type: T.TEXT, allowNull: false, defaultValue: '{}' }, { transaction: t }); }
      if (!kd.paa) { await queryInterface.addColumn('keyword_daily', 'paa', { type: T.TEXT, allowNull: false, defaultValue: '[]' }, { transaction: t }); }
      if (!kd.serp_trust) { await queryInterface.addColumn('keyword_daily', 'serp_trust', { type: T.INTEGER, allowNull: true }, { transaction: t }); }

      const tablas = await queryInterface.showAllTables();
      const id = { type: T.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true };
      if (!tablas.includes('ai_prompt')) {
         await queryInterface.createTable('ai_prompt', {
            ID: id, domain: { type: T.STRING, allowNull: false }, prompt: { type: T.STRING(500), allowNull: false },
            tags: { type: T.TEXT, allowNull: false, defaultValue: '[]' }, active: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
            location_code: { type: T.INTEGER, allowNull: true }, language_code: { type: T.STRING, allowNull: true },
            country_iso: { type: T.STRING, allowNull: true }, created_at: { type: T.STRING, allowNull: false },
         }, { transaction: t });
      }
      if (!tablas.includes('ai_run')) {
         await queryInterface.createTable('ai_run', {
            ID: id, started_at: { type: T.STRING, allowNull: false }, finished_at: { type: T.STRING, allowNull: true },
            triggered_by: { type: T.STRING, allowNull: false, defaultValue: 'cron' }, scope: { type: T.STRING, allowNull: false, defaultValue: 'all' },
            status: { type: T.STRING, allowNull: false, defaultValue: 'pending' },
            est_cost_usd: { type: T.DECIMAL(10, 6), allowNull: false, defaultValue: 0 }, cost_usd: { type: T.DECIMAL(10, 6), allowNull: false, defaultValue: 0 },
         }, { transaction: t });
      }
      if (!tablas.includes('ai_answer')) {
         await queryInterface.createTable('ai_answer', {
            ID: id, run_id: { type: T.INTEGER, allowNull: false }, prompt_id: { type: T.INTEGER, allowNull: false },
            domain: { type: T.STRING, allowNull: false }, engine: { type: T.STRING, allowNull: false }, rep: { type: T.INTEGER, allowNull: false },
            week: { type: T.STRING, allowNull: false }, task_id: { type: T.STRING, allowNull: false, defaultValue: '' },
            status: { type: T.STRING, allowNull: false, defaultValue: 'pending' },
            mentioned: { type: T.INTEGER, allowNull: false, defaultValue: 0 }, cited: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
            position: { type: T.INTEGER, allowNull: false, defaultValue: 0 },
            brands: { type: T.TEXT, allowNull: false, defaultValue: '[]' }, sources: { type: T.TEXT, allowNull: false, defaultValue: '[]' },
            fan_out: { type: T.TEXT, allowNull: false, defaultValue: '[]' }, text: { type: T.TEXT, allowNull: false, defaultValue: '' },
            raw: { type: T.TEXT, allowNull: false, defaultValue: '' }, cost_usd: { type: T.DECIMAL(10, 6), allowNull: false, defaultValue: 0 },
            error: { type: T.STRING, allowNull: false, defaultValue: '' }, created_at: { type: T.STRING, allowNull: false },
         }, { transaction: t });
         await queryInterface.addIndex('ai_answer', ['domain', 'week'], { transaction: t });
         await queryInterface.addIndex('ai_answer', ['status'], { transaction: t });
      }

      // 4) -1 → -3 en días cuyo refresco NO fue con DataForSEO. keyword_daily.date es 'YYYY-M-D'; api_usage.created_at es ISO.
      const [rows] = await queryInterface.sequelize.query(
         `SELECT kd.ID, kd.keyword_id, kd.date FROM keyword_daily kd WHERE kd.ai_cited = -1`, { transaction: t },
      );
      let cambiadas = 0;
      for (const r of rows) {
         const [y, m, d] = r.date.split('-').map((x) => parseInt(x, 10));
         const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
         // eslint-disable-next-line no-await-in-loop
         const [u] = await queryInterface.sequelize.query(
            `SELECT scraper FROM api_usage WHERE keyword_id = ? AND substr(created_at,1,10) = ? ORDER BY ID DESC LIMIT 1`,
            { replacements: [r.keyword_id, iso], transaction: t },
         );
         if (u.length && u[0].scraper !== 'dataforseo') {
            // eslint-disable-next-line no-await-in-loop
            await queryInterface.sequelize.query('UPDATE keyword_daily SET ai_cited = -3, ai_mentioned = -3 WHERE ID = ?', { replacements: [r.ID], transaction: t });
            cambiadas += 1;
         }
      }
      console.log(`[MIGRACIÓN] Visibilidad IA: ${cambiadas} días pasados de "no hubo resumen" a "no medido"`);
   }),
   down: async () => {
      console.log('[MIGRACIÓN] Visibilidad IA: la reversa no quita columnas ni tablas (SQLite recrearía keyword_daily). Revertir el código basta.');
   },
};
```

> Antes de dar por hecho el paso 4, verificar en la base local que `api_usage.scraper` guarda `'serper'` y `'dataforseo'` con esos nombres: `sqlite3 data/database.sqlite "select distinct scraper from api_usage"`. Si no hay base local con datos, copiar la de producción en modo lectura (3 archivos: `.sqlite`, `-wal`, `-shm`).

- [ ] **Step 6:** `npx jest --ci __tests__/utils/aiTrackingStates.test.ts` → PASS. Luego `npx sequelize-cli db:migrate` sobre una copia local de la base → imprime la línea `[MIGRACIÓN] …` sin error.

- [ ] **Step 7: Commit**

```bash
git add database utils/aiTracking.ts __tests__/utils/aiTrackingStates.test.ts
git commit -m "POLO-2026-11-04 (2): migración Visibilidad IA, modelos y estado no medido (-3)"
```

### Task 3: El refresco diario deja de escribir «no hubo resumen» cuando no mide IA

**Files:**
- Modify: `utils/dailySnapshot.ts` (`recordDailySnapshot`), `utils/refresh.ts:136`
- Test: `__tests__/utils/dailySnapshotAi.test.ts`

**Interfaces:**
- Consumes: `AI_NOT_MEASURED`.
- Produces: `DailySnapshot.aiOverview` con semántica: `undefined` = el proveedor no mide IA (no tocar campos `ai_*`; si la fila es nueva, `-3`) · `null` = midió y no hubo resumen (`-1`) · objeto = resumen.

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import { aiFieldsFor } from '../../utils/dailySnapshot';
import { AI_NOT_MEASURED } from '../../utils/aiTracking';

describe('aiFieldsFor', () => {
   it('undefined + fila nueva → -3', () => {
      expect(aiFieldsFor(undefined, 'ammo.cl', 'ammo', false)).toEqual({ ai_cited: AI_NOT_MEASURED, ai_mentioned: AI_NOT_MEASURED, ai_references: '[]', ai_text: '' });
   });
   it('undefined + fila existente → no toca nada', () => {
      expect(aiFieldsFor(undefined, 'ammo.cl', 'ammo', true)).toEqual({});
   });
   it('null → -1 (midió y no hubo resumen)', () => {
      expect(aiFieldsFor(null, 'ammo.cl', 'ammo', true).ai_cited).toBe(-1);
   });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/dailySnapshotAi.test.ts` → FAIL (`aiFieldsFor` no existe).

- [ ] **Step 3: Implementar** en `utils/dailySnapshot.ts` (importar `AI_NOT_MEASURED`):

```ts
/**
 * Campos ai_* de la fila del día.
 *   undefined → el proveedor de posiciones no mide IA (Serper): no se pisa lo que haya dejado Google IA ese
 *               día; si la fila es nueva, queda -3 "no medido".
 *   null      → se midió y Google no mostró resumen (-1).
 */
export const aiFieldsFor = (
   aiOverview: AiOverviewData | null | undefined, domain: string, brand: string, rowExists: boolean,
): Record<string, unknown> => {
   if (aiOverview === undefined) {
      return rowExists ? {} : { ai_cited: AI_NOT_MEASURED, ai_mentioned: AI_NOT_MEASURED, ai_references: '[]', ai_text: '' };
   }
   return {
      ai_cited: aiCitedState(aiOverview, domain),
      ai_mentioned: aiOverview?.deferred ? AI_DEFERRED : mentionState(aiOverview ? aiOverview.text : null, brand),
      ai_references: JSON.stringify(aiOverview?.references || []),
      ai_text: aiOverview?.text || '',
   };
};
```

En `recordDailySnapshot`, sacar las 4 claves `ai_*` de `values`, buscar `existing` primero y luego:
```ts
      const ai = aiFieldsFor(snap.aiOverview, snap.domain || '', brandOf(snap.domain || '', snap.brand), !!existing);
      if (existing) { await existing.update({ ...values, ...ai }); } else { await KeywordDaily.create({ ...values, ...ai }); }
```

En `utils/refresh.ts`, reemplazar la línea `aiOverview: updatedKeyword.error ? null : (updatedKeyword.aiOverview ?? null),` por:
```ts
            // solo DataForSEO trae el resumen con IA en la consulta de posiciones; con otro proveedor no se midió
            aiOverview: settings.scraper_type !== 'dataforseo' ? undefined
               : (updatedKeyword.error ? null : (updatedKeyword.aiOverview ?? null)),
```

- [ ] **Step 4:** `npx jest --ci __tests__/utils/` → todas PASS (incluidas las existentes).

- [ ] **Step 5: Commit**

```bash
git add utils/dailySnapshot.ts utils/refresh.ts __tests__/utils/dailySnapshotAi.test.ts
git commit -m "POLO-2026-11-04 (3): el refresco con Serper ya no anota 'no hubo resumen con IA'"
```

### Task 4: Settings de Visibilidad IA

**Files:**
- Modify: `types.d.ts` (`SettingsType`), `pages/api/settings.ts` (cifrar/descifrar), `utils/gotoResolver.ts` (`gotoCredentials`), `components/settings/ScraperSettings.tsx`
- Test: `__tests__/utils/gotoResolver.test.ts` (agregar caso)

**Interfaces:**
- Produces: `SettingsType.ai_dataforseo_credentials?: string`, `ai_monthly_budget_usd?: number`, `ai_max_prompts?: number`, `ai_weekly_enabled?: boolean`.

- [ ] **Step 1: Prueba que falla** — agregar en el `describe('gotoCredentials')` de `__tests__/utils/gotoResolver.test.ts`:

```ts
   it('con otro proveedor usa ai_dataforseo_credentials antes que la variable de entorno', () => {
      process.env.DATAFORSEO_GOTO_CREDENTIALS = 'env@x.cl:e';
      expect(gotoCredentials({ scraper_type: 'serper', scaping_api: 'k', ai_dataforseo_credentials: CREDS } as any)).toBe(CREDS);
      delete process.env.DATAFORSEO_GOTO_CREDENTIALS;
   });
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/gotoResolver.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** `types.d.ts`, dentro de `SettingsType`:
```ts
   /** PoloRank — Visibilidad IA (spec 2026-11-04) */
   ai_dataforseo_credentials?: string,
   ai_monthly_budget_usd?: number,
   ai_max_prompts?: number,
   ai_weekly_enabled?: boolean,
```
`utils/gotoResolver.ts`:
```ts
export const gotoCredentials = (settings: Pick<SettingsType, 'scraper_type' | 'scaping_api' | 'ai_dataforseo_credentials'>): string => {
   if (settings.scraper_type === 'dataforseo' && settings.scaping_api) { return settings.scaping_api; }
   return settings.ai_dataforseo_credentials || process.env.DATAFORSEO_GOTO_CREDENTIALS || '';
};
```
`pages/api/settings.ts`: en el guardado, junto a las otras líneas `cryptr.encrypt`:
```ts
      const ai_dataforseo_credentials = settings.ai_dataforseo_credentials ? cryptr.encrypt(settings.ai_dataforseo_credentials.trim()) : '';
```
y agregar `ai_dataforseo_credentials` al objeto `securedSettings`. Validar formato igual que `scaping_api` de DataForSEO (regex de la línea 50), con error `{ type: 'no_ai_credentials' }` si viene no vacío y mal formado. En `getAppSettings`, descifrar igual que `scaping_api` y agregar a `decryptedSettings`. En `defaultSettings`: `ai_monthly_budget_usd: 2, ai_max_prompts: 5, ai_weekly_enabled: true`.

`components/settings/ScraperSettings.tsx`, al final del formulario:
```tsx
         <div className="settings__section__secret mb-5 border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Visibilidad IA (DataForSEO)</h4>
            <SecretField
               label='DataForSEO login:password (solo IA)'
               placeholder='login@correo.com:password'
               value={settings?.ai_dataforseo_credentials || ''}
               hasError={settingsError?.type === 'no_ai_credentials'}
               onChange={(value:string) => updateSettings('ai_dataforseo_credentials', value)}
            />
            <label className={labelStyle}>Tope de gasto mensual (US$)</label>
            <input type='number' min={0} step={0.5} className='w-full p-2 border border-gray-200 rounded mb-3 text-sm'
               value={settings?.ai_monthly_budget_usd ?? 2}
               onChange={(e) => updateSettings('ai_monthly_budget_usd', parseFloat(e.target.value) || 0)} />
            <ToggleField label='Corrida semanal automática (lunes 06:00 Chile)' value={settings?.ai_weekly_enabled !== false}
               onChange={(val) => updateSettings('ai_weekly_enabled', val)} />
         </div>
```

- [ ] **Step 4:** `npx jest --ci __tests__/utils/gotoResolver.test.ts` → PASS; `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add types.d.ts pages/api/settings.ts utils/gotoResolver.ts components/settings/ScraperSettings.tsx __tests__/utils/gotoResolver.test.ts
git commit -m "POLO-2026-11-04 (4): credenciales y tope de Visibilidad IA en Settings"
```

### Task 5: Configuración por dominio, semana y presupuesto

**Files:**
- Create: `utils/aiVisibility/config.ts`, `utils/aiVisibility/week.ts`, `utils/aiVisibility/budget.ts`
- Test: `__tests__/utils/aiVisibility/config.test.ts`

**Interfaces:**
- Produces:
  - `type AiCompetitor = { name: string, variants: string[] }`
  - `type AiDomainSettings = { enabled: boolean, brand_variants: string[], brand_urls: string[], competitors: AiCompetitor[], location_code: number, language_code: string, gemini_location_code?: number, country_iso: string }`
  - `parseAiSettings(raw: string | null | undefined, domain: string): AiDomainSettings`
  - `type AiTarget = { location_code: number, gemini_location_code: number, language_code: string, country_iso: string }`
  - `targetFor(cfg: AiDomainSettings, prompt: { location_code?: number | null, language_code?: string | null, country_iso?: string | null }): AiTarget`
  - `weekOf(d: Date): string` (lunes ISO en UTC, `YYYY-MM-DD`)
  - `type Engine = 'chatgpt' | 'gemini' | 'ai_mode' | 'perplexity'`
  - `PRICES: { queue: Record<Engine, number>, live: Record<Engine, number>, google: number }`
  - `estimateCost(prompts: number, keywords: number, mode: 'queue' | 'live', reps?: number): number`
  - `monthSpend(now?: Date): Promise<number>` (suma `api_usage.cost_usd` con `scraper LIKE 'ai:%'` del mes calendario UTC)

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import { parseAiSettings, targetFor } from '../../../utils/aiVisibility/config';
import { weekOf } from '../../../utils/aiVisibility/week';
import { estimateCost } from '../../../utils/aiVisibility/budget';

describe('config IA', () => {
   it('valores por defecto desde el dominio', () => {
      const c = parseAiSettings('', 'ammo.cl');
      expect(c.enabled).toBe(false);
      expect(c.brand_variants).toEqual(['ammo']);
      expect(c.brand_urls).toEqual(['ammo.cl']);
      expect(c.location_code).toBe(2152);
   });
   it('override por prompt (Emignia desde Brasil)', () => {
      const c = parseAiSettings(JSON.stringify({ enabled: true, location_code: 2152, language_code: 'es', country_iso: 'CL' }), 'emignia.com');
      expect(targetFor(c, { location_code: 2076, language_code: 'pt', country_iso: 'BR' })).toEqual({ location_code: 2076, gemini_location_code: 2076, language_code: 'pt', country_iso: 'BR' });
   });
   it('Gemini usa la región si existe', () => {
      const c = parseAiSettings(JSON.stringify({ gemini_location_code: 20153 }), 'ammo.cl');
      expect(targetFor(c, {}).gemini_location_code).toBe(20153);
   });
});

describe('semana y costo', () => {
   it('weekOf devuelve el lunes', () => {
      expect(weekOf(new Date('2026-11-04T12:00:00Z'))).toBe('2026-11-02');
      expect(weekOf(new Date('2026-11-09T09:00:00Z'))).toBe('2026-11-09');
   });
   it('estimado semanal de Ammo (5 prompts, 8 keywords) ≈ US$0,18', () => {
      expect(estimateCost(5, 8, 'queue')).toBeCloseTo(0.178, 2);
   });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/config.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** `utils/aiVisibility/config.ts`:

```ts
/** PoloRank — Visibilidad IA: configuración por dominio (columna domain.ai_settings). */
export type AiCompetitor = { name: string, variants: string[] };
export type AiDomainSettings = {
   enabled: boolean, brand_variants: string[], brand_urls: string[], competitors: AiCompetitor[],
   location_code: number, language_code: string, gemini_location_code?: number, country_iso: string,
};
export type AiTarget = { location_code: number, gemini_location_code: number, language_code: string, country_iso: string };

const bare = (d: string): string => (d || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();

export const parseAiSettings = (raw: string | null | undefined, domain: string): AiDomainSettings => {
   let o: Partial<AiDomainSettings> = {};
   try { o = JSON.parse(raw || '{}') || {}; } catch { o = {}; }
   const host = bare(domain);
   return {
      enabled: o.enabled === true,
      brand_variants: o.brand_variants && o.brand_variants.length ? o.brand_variants : [host.split('.')[0]],
      brand_urls: o.brand_urls && o.brand_urls.length ? o.brand_urls : [host],
      competitors: Array.isArray(o.competitors) ? o.competitors : [],
      location_code: o.location_code || 2152,
      language_code: o.language_code || 'es',
      gemini_location_code: o.gemini_location_code || undefined,
      country_iso: o.country_iso || 'CL',
   };
};

export const targetFor = (
   cfg: AiDomainSettings, p: { location_code?: number | null, language_code?: string | null, country_iso?: string | null },
): AiTarget => {
   const location = p.location_code || cfg.location_code;
   return {
      location_code: location,
      // la región de Gemini solo aplica cuando el prompt no fija otro país
      gemini_location_code: p.location_code ? p.location_code : (cfg.gemini_location_code || location),
      language_code: p.language_code || cfg.language_code,
      country_iso: p.country_iso || cfg.country_iso,
   };
};
```

`utils/aiVisibility/week.ts`:
```ts
/** Lunes (UTC) de la semana ISO de `d`, 'YYYY-MM-DD'. Una semana = un dato en Visibilidad IA. */
export const weekOf = (d: Date): string => {
   const day = d.getUTCDay() || 7; // domingo = 7
   const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)));
   return monday.toISOString().slice(0, 10);
};
export default weekOf;
```

`utils/aiVisibility/budget.ts`:
```ts
import { Op } from 'sequelize';
import ApiUsage from '../../database/models/apiUsage';

export type Engine = 'chatgpt' | 'gemini' | 'ai_mode' | 'perplexity';
export const ENGINES: Engine[] = ['chatgpt', 'gemini', 'ai_mode', 'perplexity'];
export const REPS = 3;

/** US$ por llamada. AI Mode: confirmar con la Task 1 y corregir aquí. */
export const PRICES = {
   queue: { chatgpt: 0.0012, gemini: 0.0012, ai_mode: 0.002, perplexity: 0.006 } as Record<Engine, number>,
   live: { chatgpt: 0.004, gemini: 0.004, ai_mode: 0.002, perplexity: 0.006 } as Record<Engine, number>,
   google: 0.002,
};

/** Estimado de una corrida. Google IA incluye ~40% de reintentos por páginas envenenadas. */
export const estimateCost = (prompts: number, keywords: number, mode: 'queue' | 'live', reps: number = REPS): number => {
   const perPrompt = ENGINES.reduce((s, e) => s + PRICES[mode][e], 0) * reps;
   return prompts * perPrompt + keywords * PRICES.google * 1.4;
};

/** Gasto del mes calendario (UTC) de Visibilidad IA. */
export const monthSpend = async (now: Date = new Date()): Promise<number> => {
   const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toJSON();
   const rows = await ApiUsage.findAll({ where: { scraper: { [Op.like]: 'ai:%' }, created_at: { [Op.gte]: from } } });
   return rows.reduce((s, r) => s + Number(r.get('cost_usd') || 0), 0);
};
```

> Cuenta del test: por prompt en cola = (0,0012+0,0012+0,002+0,006)×3 = 0,0312 → ×5 = 0,156; Google 8×0,002×1,4 = 0,0224 → total 0,178 (el ~0,17 del spec no incluía reintentos).

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/config.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/aiVisibility __tests__/utils/aiVisibility
git commit -m "POLO-2026-11-04 (5): configuración IA por dominio, semana ISO y presupuesto"
```

### Task 6: Cliente DataForSEO y motores

**Files:**
- Create: `utils/aiVisibility/dfs.ts`, `utils/aiVisibility/engines.ts`
- Test: `__tests__/utils/aiVisibility/engines.test.ts`

**Interfaces:**
- Consumes: `parseCredentials` (`scrapers/services/dataforseo.ts`), `AiTarget`, `Engine`.
- Produces:
  - `dfsCall(method: 'GET' | 'POST', path: string, creds: string, body?: unknown, timeoutMs?: number): Promise<{ ok: boolean, cost: number, task: any, error?: string }>`
  - `type ParsedSource = { domain: string, url: string, title: string }`
  - `type ParsedAnswer = { text: string, sources: ParsedSource[], fanOut: string[], entities: string[] }`
  - `ENGINE_DEF: Record<Engine, { live: string, post?: string, get?: (id: string) => string, task: (prompt: string, t: AiTarget) => Record<string, unknown>, parse: (result: any) => ParsedAnswer }>`

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { ENGINE_DEF } from '../../../utils/aiVisibility/engines';

const res = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', f), 'utf8')).tasks[0].result[0];

describe('parsers por motor (respuestas reales del piloto)', () => {
   it('ChatGPT: texto, fuentes con ammo.cl, búsquedas internas y marcas en orden', () => {
      const p = ENGINE_DEF.chatgpt.parse(res('chatgpt-venta-1.json'));
      expect(p.text).toContain('Ammo');
      expect(p.sources.some((s) => s.domain === 'ammo.cl')).toBe(true);
      expect(p.fanOut.length).toBeGreaterThan(0);
      expect(p.entities.slice(0, 2)).toEqual(['Armario de la Karo', 'Ammo Store (AMMÔ)']);
   });
   it('Gemini: texto y fuentes', () => {
      const p = ENGINE_DEF.gemini.parse(res('gemini-arriendo-1.json'));
      expect(p.text).toContain('Ammo Store');
      expect(p.sources.some((s) => s.domain === 'ammo.cl')).toBe(true);
   });
   it('Perplexity: texto de las secciones y resultados de búsqueda', () => {
      const p = ENGINE_DEF.perplexity.parse(res('perplexity-venta-1.json'));
      expect(p.text).toContain('Armario de la Karo');
      expect(p.sources.length).toBeGreaterThan(0);
   });
   it('AI Mode: texto y referencias (fixture de la Task 1)', () => {
      const p = ENGINE_DEF.ai_mode.parse(res('ai-mode-ammo.json'));
      expect(p.text.length).toBeGreaterThan(50);
   });
   it('tareas con la ubicación correcta', () => {
      const t = { location_code: 2152, gemini_location_code: 20153, language_code: 'es', country_iso: 'CL' };
      expect(ENGINE_DEF.gemini.task('hola', t)).toEqual({ keyword: 'hola', location_code: 20153, language_code: 'es' });
      expect(ENGINE_DEF.perplexity.task('hola', t)).toEqual({ user_prompt: 'hola', model_name: 'sonar', web_search_country_iso_code: 'CL' });
   });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/engines.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** `utils/aiVisibility/dfs.ts`:

```ts
import { parseCredentials } from '../../scrapers/services/dataforseo';

const BASE = process.env.DATAFORSEO_BASE || 'https://api.dataforseo.com/v3';

/** Una llamada a DataForSEO con una sola tarea. Nunca lanza: devuelve ok=false con el motivo. */
export const dfsCall = async (
   method: 'GET' | 'POST', path: string, rawCreds: string, body?: unknown, timeoutMs = 150000,
): Promise<{ ok: boolean, cost: number, task: any, error?: string }> => {
   const creds = parseCredentials(rawCreds);
   if (!creds) { return { ok: false, cost: 0, task: null, error: 'Faltan credenciales de DataForSEO para IA' }; }
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), timeoutMs);
   try {
      const r = await fetch(`${BASE}${path}`, {
         method,
         headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString('base64')}` },
         body: body ? JSON.stringify(body) : undefined,
         signal: controller.signal,
      });
      const json: any = await r.json();
      const task = json?.tasks?.[0] || null;
      const cost = Number(json?.cost || 0);
      if (json?.status_code !== 20000) { return { ok: false, cost, task, error: `${json?.status_code} ${json?.status_message}` }; }
      return { ok: true, cost, task };
   } catch (e: any) {
      return { ok: false, cost: 0, task: null, error: e?.name === 'AbortError' ? 'Tiempo de espera agotado' : String(e?.message || e) };
   } finally { clearTimeout(timer); }
};
export default dfsCall;
```

`utils/aiVisibility/engines.ts`:
```ts
/**
 * PoloRank — los 4 motores de Visibilidad IA: endpoint, tarea y lectura de la respuesta.
 * Estructuras verificadas con respuestas reales (piloto 2026-11-04 y Task 1).
 * AI Mode: <anotar aquí lo observado en la Task 1: tipo de ítem y campos>.
 */
import type { AiTarget } from './config';
import type { Engine } from './budget';

export type ParsedSource = { domain: string, url: string, title: string };
export type ParsedAnswer = { text: string, sources: ParsedSource[], fanOut: string[], entities: string[] };

const host = (u: string): string => (u || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
const src = (arr: any[] | null | undefined): ParsedSource[] => (arr || [])
   .filter((s) => s && s.url)
   .map((s) => ({ domain: host(s.url), url: s.url, title: s.title || '' }));
const uniq = (s: ParsedSource[]): ParsedSource[] => s.filter((x, i) => s.findIndex((y) => y.url === x.url) === i);

const parseScraper = (r: any): ParsedAnswer => ({
   text: r?.markdown || '',
   sources: uniq([...src(r?.sources), ...src(r?.search_results)]),
   fanOut: r?.fan_out_queries || [],
   entities: (r?.brand_entities || []).map((b: any) => b.title).filter(Boolean),
});

const parseResponses = (r: any): ParsedAnswer => {
   const sections = (r?.items || []).flatMap((it: any) => it.sections || []);
   return {
      text: sections.map((s: any) => s.text || '').join('\n'),
      sources: uniq([...src(sections.flatMap((s: any) => s.annotations || [])), ...src(r?.search_results)]),
      fanOut: r?.fan_out_queries || [],
      entities: [],
   };
};

const parseAiMode = (r: any): ParsedAnswer => {
   const items = (r?.items || []).filter((i: any) => i.type === 'ai_overview');
   return {
      text: items.map((i: any) => i.markdown || '').join('\n'),
      sources: uniq(src(items.flatMap((i: any) => i.references || []))),
      fanOut: [],
      entities: [],
   };
};

type EngineDef = {
   live: string, post?: string, get?: (id: string) => string,
   task: (prompt: string, t: AiTarget) => Record<string, unknown>, parse: (result: any) => ParsedAnswer,
};

export const ENGINE_DEF: Record<Engine, EngineDef> = {
   chatgpt: {
      live: '/ai_optimization/chat_gpt/llm_scraper/live/advanced',
      post: '/ai_optimization/chat_gpt/llm_scraper/task_post',
      get: (id) => `/ai_optimization/chat_gpt/llm_scraper/task_get/advanced/${id}`,
      task: (q, t) => ({ keyword: q, location_code: t.location_code, language_code: t.language_code }),
      parse: parseScraper,
   },
   gemini: {
      live: '/ai_optimization/gemini/llm_scraper/live/advanced',
      post: '/ai_optimization/gemini/llm_scraper/task_post',
      get: (id) => `/ai_optimization/gemini/llm_scraper/task_get/advanced/${id}`,
      task: (q, t) => ({ keyword: q, location_code: t.gemini_location_code, language_code: t.language_code }),
      parse: parseScraper,
   },
   ai_mode: {
      live: '/serp/google/ai_mode/live/advanced',
      post: '/serp/google/ai_mode/task_post',
      get: (id) => `/serp/google/ai_mode/task_get/advanced/${id}`,
      task: (q, t) => ({ keyword: q, location_code: t.location_code, language_code: t.language_code, device: 'mobile' }),
      parse: parseAiMode,
   },
   perplexity: {
      // Sonar no admite cola: siempre live
      live: '/ai_optimization/perplexity/llm_responses/live',
      task: (q, t) => ({ user_prompt: q, model_name: 'sonar', web_search_country_iso_code: t.country_iso }),
      parse: parseResponses,
   },
};
export default ENGINE_DEF;
```

> Si el fixture de AI Mode de la Task 1 muestra otro tipo de ítem o campo, ajustar `parseAiMode` y el comentario de cabecera.

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/engines.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/aiVisibility/dfs.ts utils/aiVisibility/engines.ts __tests__/utils/aiVisibility/engines.test.ts
git commit -m "POLO-2026-11-04 (6): cliente DataForSEO y lectura de ChatGPT, Gemini, AI Mode y Perplexity"
```

### Task 7: Análisis de cada respuesta

**Files:**
- Create: `utils/aiVisibility/analyze.ts`
- Test: `__tests__/utils/aiVisibility/analyze.test.ts`

**Interfaces:**
- Consumes: `ParsedAnswer`, `AiDomainSettings`, `flat`, `prose`, `MIN_BRAND_LENGTH` (`utils/aiTracking.ts`).
- Produces: `type AnswerAnalysis = { mentioned: 0 | 1, cited: 0 | 1, position: number, brands: string[] }` · `analyzeAnswer(p: ParsedAnswer, cfg: AiDomainSettings): AnswerAnalysis` · `newCompetitors(entities: string[], cfg: AiDomainSettings): string[]`

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { ENGINE_DEF } from '../../../utils/aiVisibility/engines';
import { analyzeAnswer, newCompetitors } from '../../../utils/aiVisibility/analyze';
import { parseAiSettings } from '../../../utils/aiVisibility/config';

const res = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', f), 'utf8')).tasks[0].result[0];
const ammo = parseAiSettings(JSON.stringify({
   enabled: true, brand_variants: ['Ammo'], brand_urls: ['ammo.cl', 'instagram.com/ammostorechile'],
   competitors: [{ name: 'Armario de la Karo', variants: ['Armario de la Karo'] }, { name: 'Blanka Atelier', variants: ['Blanka'] }],
}), 'ammo.cl');

describe('analyzeAnswer', () => {
   it('ChatGPT venta: te nombra, te cita y quedas #2 detrás de Armario de la Karo', () => {
      const a = analyzeAnswer(ENGINE_DEF.chatgpt.parse(res('chatgpt-venta-1.json')), ammo);
      expect(a).toMatchObject({ mentioned: 1, cited: 1, position: 2 });
      expect(a.brands[0]).toBe('Armario de la Karo');
   });
   it('Claude escribe "Ammô Store" con acento y igual cuenta como nombrado', () => {
      const a = analyzeAnswer(ENGINE_DEF.perplexity.parse(res('claude-venta-1.json')), ammo);
      expect(a.mentioned).toBe(1);
      expect(a.cited).toBe(1); // instagram.com/ammostorechile
   });
   it('Perplexity: no te nombra ni te cita', () => {
      const a = analyzeAnswer(ENGINE_DEF.perplexity.parse(res('perplexity-venta-1.json')), ammo);
      expect(a).toMatchObject({ mentioned: 0, cited: 0, position: 0 });
      expect(a.brands).toContain('Armario de la Karo');
   });
   it('competidores nuevos de ChatGPT que no están configurados', () => {
      const p = ENGINE_DEF.chatgpt.parse(res('chatgpt-venta-1.json'));
      expect(newCompetitors(p.entities, ammo)).toEqual(expect.arrayContaining(['Jeannette Menard']));
      expect(newCompetitors(p.entities, ammo)).not.toContain('Ammo Store (AMMÔ)');
   });
});
```
(Claude usa el mismo formato de LLM Responses que Perplexity; por eso se lee con `ENGINE_DEF.perplexity.parse`.)

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/analyze.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `utils/aiVisibility/analyze.ts`:

```ts
import { flat, prose, MIN_BRAND_LENGTH } from '../aiTracking';
import type { ParsedAnswer } from './engines';
import type { AiDomainSettings } from './config';

export type AnswerAnalysis = { mentioned: 0 | 1, cited: 0 | 1, position: number, brands: string[] };

const OWN = '__own__';

/** Índice de la primera aparición de alguna variante en el texto aplanado, o -1. */
const firstIndex = (flatText: string, variants: string[]): number => {
   const idx = variants.map(flat).filter((v) => v.length >= MIN_BRAND_LENGTH).map((v) => flatText.indexOf(v)).filter((i) => i >= 0);
   return idx.length ? Math.min(...idx) : -1;
};

const matches = (name: string, variants: string[]): boolean => {
   const n = flat(name);
   return variants.map(flat).some((v) => v.length >= MIN_BRAND_LENGTH && n.includes(v));
};

const citesUs = (url: string, brandUrls: string[]): boolean => {
   const u = (url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
   return brandUrls.some((b) => {
      const x = b.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      return x.includes('/') ? u.startsWith(x) : (u.split('/')[0] === x || u.split('/')[0].endsWith(`.${x}`));
   });
};

export const analyzeAnswer = (p: ParsedAnswer, cfg: AiDomainSettings): AnswerAnalysis => {
   const text = flat(prose(p.text));
   const mentioned: 0 | 1 = firstIndex(text, cfg.brand_variants) >= 0 ? 1 : 0;
   const cited: 0 | 1 = p.sources.some((s) => citesUs(s.url, cfg.brand_urls)) ? 1 : 0;

   let ordered: string[];
   if (p.entities.length) {
      // ChatGPT ya entrega las marcas en orden: se normalizan al nombre propio / del competidor configurado
      ordered = p.entities.map((e) => {
         if (matches(e, cfg.brand_variants)) { return OWN; }
         const c = cfg.competitors.find((x) => matches(e, [x.name, ...x.variants]));
         return c ? c.name : e;
      });
   } else {
      const found = [{ name: OWN, i: firstIndex(text, cfg.brand_variants) },
         ...cfg.competitors.map((c) => ({ name: c.name, i: firstIndex(text, [c.name, ...c.variants]) }))]
         .filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
      ordered = found.map((x) => x.name);
   }
   ordered = ordered.filter((x, i) => ordered.indexOf(x) === i);
   const pos = ordered.indexOf(OWN);
   return {
      mentioned,
      cited,
      position: mentioned && pos >= 0 ? pos + 1 : 0,
      brands: ordered.map((x) => (x === OWN ? cfg.brand_variants[0] : x)),
   };
};

/** Marcas que ChatGPT nombró y que no son la propia ni un competidor configurado. */
export const newCompetitors = (entities: string[], cfg: AiDomainSettings): string[] => entities
   .filter((e) => !matches(e, cfg.brand_variants))
   .filter((e) => !cfg.competitors.some((c) => matches(e, [c.name, ...c.variants])));
```

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/analyze.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/aiVisibility/analyze.ts __tests__/utils/aiVisibility/analyze.test.ts
git commit -m "POLO-2026-11-04 (7): análisis de respuestas (te nombra, te cita, lugar, competidores)"
```

---

# ETAPA 2 — Google IA semanal

### Task 8: Detección de página envenenada

**Files:**
- Create: `utils/aiVisibility/trust.ts`
- Test: `__tests__/utils/aiVisibility/trust.test.ts`

**Interfaces:**
- Produces: `organicHosts(items: any[]): string[]` (top 10 de DataForSEO; los `goto` toman el host de `breadcrumb` si es URL, si no se descartan) · `serpTrust(dfsHosts: string[], serperHosts: string[]): 0 | 1 | null` (null si Serper no tiene datos)

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { organicHosts, serpTrust } from '../../../utils/aiVisibility/trust';

const fx = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', f), 'utf8'));
const serper = fx('serper-1.json').organic.map((o: any) => o.link.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]);

describe('serpTrust (prueba real 2026-11-04)', () => {
   it('dfs-1 envenenada → 0', () => { expect(serpTrust(organicHosts(fx('dfs-1.json')[0].items), serper)).toBe(0); });
   it('dfs-2 normal → 1', () => { expect(serpTrust(organicHosts(fx('dfs-2.json')[0].items), serper)).toBe(1); });
   it('sin datos de Serper → null', () => { expect(serpTrust(['a.cl'], [])).toBeNull(); });
});
```
(Los `dfs-*.json` guardan el arreglo `result`, no la respuesta completa: por eso `[0].items`.)

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/trust.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `utils/aiVisibility/trust.ts`:

```ts
const host = (u: string): string => (u || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
const GOTO = /google\.[a-z.]+\/goto\?/i;

/** Dominios del top 10 orgánico de DataForSEO. Los goto toman el dominio de breadcrumb cuando es una URL. */
export const organicHosts = (items: any[]): string[] => (items || [])
   .filter((i) => i.type === 'organic')
   .sort((a, b) => (a.rank_group || 0) - (b.rank_group || 0))
   .slice(0, 10)
   .map((i) => {
      if (!GOTO.test(i.url || '')) { return host(i.url); }
      const b = (i.breadcrumb || '').split(' ')[0];
      return /^https?:\/\//.test(b) ? host(b) : '';
   })
   .filter(Boolean);

/**
 * ¿La página de DataForSEO es la real? Se compara con el top de Serper de la misma palabra clave.
 * Envenenada = aparece menos de la mitad de los dominios de Serper (regla de Nozzle adaptada).
 */
export const serpTrust = (dfsHosts: string[], serperHosts: string[]): 0 | 1 | null => {
   const ref = [...new Set(serperHosts.filter(Boolean))];
   if (ref.length === 0) { return null; }
   const got = new Set(dfsHosts);
   const share = ref.filter((h) => got.has(h)).length / ref.length;
   return share >= 0.5 ? 1 : 0;
};
```

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/trust.test.ts` → PASS. Si dfs-1 diera 1, imprimir `share` y ajustar el umbral **solo** si dfs-2 sigue en 1 y dfs-1/dfs-3 en 0; anotar el valor en el comentario.

- [ ] **Step 5: Commit**

```bash
git add utils/aiVisibility/trust.ts __tests__/utils/aiVisibility/trust.test.ts
git commit -m "POLO-2026-11-04 (8): detección de páginas envenenadas comparando con Serper"
```

### Task 9: Corrida Google IA de un dominio

**Files:**
- Create: `utils/aiVisibility/googleIa.ts`
- Test: `__tests__/utils/aiVisibility/googleIa.test.ts`

**Interfaces:**
- Consumes: `dfsCall`, `organicHosts`, `serpTrust`, `extractAiOverview` (`scrapers/services/dataforseo.ts`, exportarlo si no lo está), `aiCitedState`, `mentionState`, `brandOf`, `logUsage`, `KeywordDaily`, `Keyword`.
- Produces: `extractLocalPack(items: any[], domain: string): { present: boolean, position: number, items: { title: string, domain: string, rating: number | null }[] }` · `extractPaa(items: any[]): string[]` · `runGoogleIa(domain: string, creds: string, triggeredBy: string): Promise<{ keywords: number, cost: number, untrusted: number }>`

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { extractLocalPack, extractPaa } from '../../../utils/aiVisibility/googleIa';

const items = JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', 'dfs-2.json'), 'utf8'))[0].items;

describe('datos extra de la página de Google', () => {
   it('Local Pack presente con negocios', () => {
      const lp = extractLocalPack(items, 'ammo.cl');
      expect(lp.items.length).toBeGreaterThan(0);
      expect(typeof lp.position).toBe('number');
   });
   it('PAA devuelve un arreglo de textos', () => {
      expect(Array.isArray(extractPaa(items))).toBe(true);
   });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/googleIa.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `utils/aiVisibility/googleIa.ts`:

```ts
import Keyword from '../../database/models/keyword';
import KeywordDaily from '../../database/models/keywordDaily';
import Domain from '../../database/models/domain';
import { extractAiOverview } from '../../scrapers/services/dataforseo';
import { aiCitedState } from '../dailySnapshot';
import { brandOf, mentionState, AI_DEFERRED } from '../aiTracking';
import { logUsage } from '../usage';
import { dfsCall } from './dfs';
import { organicHosts, serpTrust } from './trust';
import { PRICES } from './budget';

const host = (u: string): string => (u || '').replace(/^https?:\/\//, '').replace(/^www\./i, '').split('/')[0].toLowerCase();

export const extractLocalPack = (items: any[], domain: string) => {
   const lp = (items || []).filter((i) => i.type === 'local_pack');
   const list = lp.map((i) => ({ title: i.title || '', domain: host(i.url || i.domain || ''), rating: i.rating?.value ?? null }));
   const idx = list.findIndex((x) => x.domain === host(domain) || (x.title || '').toLowerCase().includes(brandOf(domain)));
   return { present: idx >= 0, position: idx >= 0 ? idx + 1 : 0, items: list };
};

export const extractPaa = (items: any[]): string[] => (items || [])
   .filter((i) => i.type === 'people_also_ask')
   .flatMap((i) => (i.items || []).map((q: any) => q.title).filter(Boolean));

const dateKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Una consulta de página completa. Devuelve los ítems y el costo, o null si falló. */
const fetchSerp = async (kw: any, creds: string) => {
   const r = await dfsCall('POST', '/serp/google/organic/live/advanced', creds, [{
      keyword: kw.keyword, language_code: 'es', location_code: 2152, device: kw.device === 'mobile' ? 'mobile' : 'desktop',
      os: kw.device === 'mobile' ? 'android' : 'windows', depth: 10,
   }]);
   return { ok: r.ok && !!r.task?.result?.[0], cost: r.cost, result: r.task?.result?.[0], error: r.error };
};

/**
 * Google IA de un dominio: 1 consulta por palabra clave (+1 reintento si la página viene envenenada).
 * Escribe en la fila del día de keyword_daily solo los campos de IA y página; posición y URL no se tocan.
 */
export const runGoogleIa = async (domain: string, creds: string, triggeredBy: string) => {
   const dom = await Domain.findOne({ where: { domain } });
   let brand = '';
   try { brand = JSON.parse((dom?.get('audit_settings') as string) || '{}').brand || ''; } catch { brand = ''; }
   const keywords = await Keyword.findAll({ where: { domain } });
   let cost = 0; let untrusted = 0;
   for (const k of keywords) {
      const kw: any = k.get({ plain: true });
      let lastResult: any[] = [];
      try { lastResult = JSON.parse(kw.lastResult || '[]'); } catch { lastResult = []; }
      const serperHosts = lastResult.slice(0, 10).map((r: any) => host(r.url));
      let trust: 0 | 1 | null = null; let res: any = null;
      for (let intento = 1; intento <= 2; intento += 1) {
         // eslint-disable-next-line no-await-in-loop
         const s = await fetchSerp(kw, creds);
         cost += s.cost;
         // eslint-disable-next-line no-await-in-loop
         await logUsage({ scraper: 'ai:google', domain, keywordID: kw.ID, keyword: kw.keyword, depth: 10, costUSD: s.cost || PRICES.google, triggeredBy, status: s.ok ? 'ok' : 'error' });
         if (!s.ok) { break; }
         res = s.result;
         trust = serpTrust(organicHosts(res.items || []), serperHosts);
         if (trust !== 0) { break; }
      }
      if (!res) { continue; }
      if (trust === 0) { untrusted += 1; }
      const ai = extractAiOverview({ tasks: [{ result: [res] }] } as any);
      const values = {
         ai_cited: aiCitedState(ai, domain),
         ai_mentioned: ai?.deferred ? AI_DEFERRED : mentionState(ai ? ai.text : null, brandOf(domain, brand)),
         ai_references: JSON.stringify(ai?.references || []),
         ai_text: ai?.text || '',
         local_pack: JSON.stringify(extractLocalPack(res.items || [], domain)),
         paa: JSON.stringify(extractPaa(res.items || [])),
         serp_trust: trust,
      };
      const where = { keyword_id: kw.ID, date: dateKey(new Date()) };
      // eslint-disable-next-line no-await-in-loop
      const row = await KeywordDaily.findOne({ where });
      // eslint-disable-next-line no-await-in-loop
      if (row) { await row.update(values); } else {
         // eslint-disable-next-line no-await-in-loop
         await KeywordDaily.create({ ...where, ...values, position: kw.position || 0, url: kw.url || '', measured: false });
      }
   }
   return { keywords: keywords.length, cost, untrusted };
};
```

> Revisar la firma real de `extractAiOverview` en `scrapers/services/dataforseo.ts:127` (recibe la respuesta completa o el `result`): adaptar el argumento para que lea `res.items`. Exportarla si no lo está.

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/` → PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/aiVisibility/googleIa.ts scrapers/services/dataforseo.ts __tests__/utils/aiVisibility/googleIa.test.ts
git commit -m "POLO-2026-11-04 (9): corrida Google IA con Local Pack, preguntas y página no confiable"
```

### Task 10: Tabla Google IA en semanas, Local Pack y «no confiable»

**Files:**
- Modify: `pages/api/ai-tracking.ts`, `services/aiTracking.tsx`, `components/aitracking/AiTrackingTable.tsx`, `components/aitracking/AiDetailPanel.tsx`
- Test: `__tests__/utils/aiTrackingWeeks.test.ts`

**Interfaces:**
- Produces: `citationPeriodsWeeks(rows: (DailyCite & { serp_trust?: number | null })[], now?: Date) => { w4: CitationRatio, w8: CitationRatio, w12: CitationRatio }` en `utils/aiTracking.ts`; `AiTrackingRow` suma `localPack: { present: boolean, position: number }`, `trusted: boolean`, `paa: string[]`, `periods: { w4, w8, w12 }`.

- [ ] **Step 1: Prueba que falla**

```ts
/** @jest-environment node */
import { citationPeriodsWeeks } from '../../utils/aiTracking';

it('las páginas no confiables no cuentan', () => {
   const now = new Date(2026, 11, 28);
   const rows = [
      { date: '2026-10-5', ai_cited: 1, serp_trust: 1 },
      { date: '2026-12-7', ai_cited: 1, serp_trust: 1 },
      { date: '2026-12-14', ai_cited: 0, serp_trust: 0 },
      { date: '2026-12-21', ai_cited: 0, serp_trust: 1 },
   ];
   const p = citationPeriodsWeeks(rows, now);
   expect(p.w4 && p.w4.withAi).toBe(2);
   expect(p.w4 && p.w4.cited).toBe(1);
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiTrackingWeeks.test.ts` → FAIL.

- [ ] **Step 3: Implementar** en `utils/aiTracking.ts`:

```ts
/** Igual que citationPeriods pero en semanas (Google IA es semanal) y sin las páginas envenenadas. */
export const citationPeriodsWeeks = (rows: (DailyCite & { serp_trust?: number | null })[], now: Date = new Date()) => {
   const ok = rows.filter((r) => r.serp_trust !== 0);
   return { w4: citationRatio(ok, 28, now), w8: citationRatio(ok, 56, now), w12: citationRatio(ok, 84, now) };
};
```
En `pages/api/ai-tracking.ts`: leer también `local_pack`, `paa`, `serp_trust` de cada día; `periods: citationPeriodsWeeks(days.map(...))`; el "último día" (`lastWithAi`) pasa a ser el último con `ai_cited >= 0 || ai_cited === -1` **y** `serp_trust !== 0` (los -3 no son "último dato"); devolver `localPack` (`{present, position}` del último día con `local_pack` no vacío), `trusted` (`serp_trust !== 0` del último día) y `paa`.
En `services/aiTracking.tsx`: actualizar el tipo `AiTrackingRow` igual.
En `AiTrackingTable.tsx`: cabeceras de períodos `4 sem · 8 sem · 12 sem` (claves `w4/w8/w12`; texto emergente "Te citó X de las Y semanas con resumen"); nueva columna **Local Pack** (`#N` o `—`); si `!row.trusted`, insignia gris `no confiable` con título "La página de Google de esta semana vino alterada (no coincide con Serper). No cuenta en las tasas.".
En `AiDetailPanel.tsx`: bloque "Otras preguntas de los usuarios" con la lista `paa` (si no está vacía).

- [ ] **Step 4:** `npx jest --ci __tests__/utils/` → PASS; `npx tsc --noEmit` → sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add utils/aiTracking.ts pages/api/ai-tracking.ts services/aiTracking.tsx components/aitracking __tests__/utils/aiTrackingWeeks.test.ts
git commit -m "POLO-2026-11-04 (10): Google IA en semanas, Local Pack y marca de página no confiable"
```

---

# ETAPA 3 — Asistentes IA (backend)

### Task 11: Corredor (cola semanal, recolección y en vivo)

**Files:**
- Create: `utils/aiVisibility/runner.ts`
- Test: `__tests__/utils/aiVisibility/runner.test.ts`

**Interfaces:**
- Consumes: todo lo anterior + modelos.
- Produces:
  - `type RunScope = { kind: 'all' } | { kind: 'domain', domain: string } | { kind: 'prompt', promptId: number } | { kind: 'google', domain: string }`
  - `planRun(scope: RunScope, mode: 'queue' | 'live'): Promise<{ prompts: AiPrompt[], domains: string[], keywords: number, estimate: number }>`
  - `startRun(scope: RunScope, mode: 'queue' | 'live', triggeredBy: string, settings: SettingsType): Promise<{ runId: number, status: string, estimate: number }>`
  - `collectPending(settings: SettingsType): Promise<{ collected: number, errors: number }>`
  - `packRaw(obj: unknown): string` / `unpackRaw(s: string): unknown` (zlib + base64)

- [ ] **Step 1: Prueba que falla** (se prueba la regla de presupuesto y el empaquetado; las llamadas se simulan con `fetchMock`)

```ts
/** @jest-environment node */
import { packRaw, unpackRaw, budgetAllows } from '../../../utils/aiVisibility/runner';

describe('runner', () => {
   it('raw comprimido ida y vuelta', () => {
      const o = { a: 'Ammô', n: [1, 2, 3] };
      expect(unpackRaw(packRaw(o))).toEqual(o);
   });
   it('el presupuesto corta antes de llamar', () => {
      expect(budgetAllows(1.9, 0.17, 2)).toBe(false);
      expect(budgetAllows(1.0, 0.17, 2)).toBe(true);
   });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/runner.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `utils/aiVisibility/runner.ts`:

```ts
import zlib from 'zlib';
import { Op } from 'sequelize';
import AiPrompt from '../../database/models/aiPrompt';
import AiRun from '../../database/models/aiRun';
import AiAnswer from '../../database/models/aiAnswer';
import Domain from '../../database/models/domain';
import Keyword from '../../database/models/keyword';
import { logUsage } from '../usage';
import { dfsCall } from './dfs';
import { ENGINE_DEF } from './engines';
import { analyzeAnswer } from './analyze';
import { parseAiSettings, targetFor, AiDomainSettings } from './config';
import { ENGINES, REPS, Engine, estimateCost, monthSpend } from './budget';
import { weekOf } from './week';
import { runGoogleIa } from './googleIa';

export type RunScope = { kind: 'all' } | { kind: 'domain', domain: string } | { kind: 'prompt', promptId: number } | { kind: 'google', domain: string };

export const packRaw = (o: unknown): string => zlib.deflateSync(Buffer.from(JSON.stringify(o))).toString('base64');
export const unpackRaw = (s: string): unknown => JSON.parse(zlib.inflateSync(Buffer.from(s, 'base64')).toString());
export const budgetAllows = (spent: number, estimate: number, budget: number): boolean => spent + estimate <= budget;

const POOL = 5;
const pool = async <T>(jobs: (() => Promise<T>)[]): Promise<T[]> => {
   const out: T[] = []; let i = 0;
   const worker = async () => { while (i < jobs.length) { const j = i; i += 1; out[j] = await jobs[j](); } };
   await Promise.all(Array.from({ length: Math.min(POOL, jobs.length) }, worker));
   return out;
};

const enabledDomains = async (): Promise<Map<string, AiDomainSettings>> => {
   const all = await Domain.findAll();
   const m = new Map<string, AiDomainSettings>();
   all.forEach((d) => {
      const cfg = parseAiSettings(d.get('ai_settings') as string, d.get('domain') as string);
      if (cfg.enabled) { m.set(d.get('domain') as string, cfg); }
   });
   return m;
};

export const planRun = async (scope: RunScope, mode: 'queue' | 'live') => {
   const doms = await enabledDomains();
   let domains: string[] = [];
   if (scope.kind === 'all') { domains = [...doms.keys()]; }
   if (scope.kind === 'domain' || scope.kind === 'google') { domains = doms.has(scope.domain) ? [scope.domain] : []; }
   let prompts: AiPrompt[] = [];
   if (scope.kind === 'prompt') {
      const p = await AiPrompt.findByPk(scope.promptId);
      if (p && doms.has(p.get('domain') as string)) { prompts = [p]; domains = [p.get('domain') as string]; }
   } else if (scope.kind !== 'google' && domains.length) {
      prompts = await AiPrompt.findAll({ where: { domain: { [Op.in]: domains }, active: true } });
   }
   const keywords = (scope.kind === 'all' || scope.kind === 'google') && domains.length
      ? await Keyword.count({ where: { domain: { [Op.in]: domains } } }) : 0;
   return { prompts, domains, keywords, estimate: estimateCost(prompts.length, keywords, mode), cfgs: doms };
};

/** Guarda una respuesta ya recibida: análisis + raw comprimido. */
const storeResult = async (answer: AiAnswer, engine: Engine, result: any, cost: number, cfg: AiDomainSettings) => {
   const parsed = ENGINE_DEF[engine].parse(result);
   const a = analyzeAnswer(parsed, cfg);
   await answer.update({
      status: 'ok', mentioned: a.mentioned, cited: a.cited, position: a.position,
      brands: JSON.stringify(a.brands), sources: JSON.stringify(parsed.sources), fan_out: JSON.stringify(parsed.fanOut),
      text: parsed.text, raw: packRaw(result), cost_usd: Number(answer.get('cost_usd') || 0) + cost,
   });
};

export const startRun = async (scope: RunScope, mode: 'queue' | 'live', triggeredBy: string, settings: SettingsType) => {
   const creds = settings.ai_dataforseo_credentials || '';
   const plan = await planRun(scope, mode);
   const run = await AiRun.create({ started_at: new Date().toJSON(), triggered_by: triggeredBy, scope: scope.kind === 'all' ? 'all' : `${scope.kind}:${'domain' in scope ? scope.domain : (scope as any).promptId}`, est_cost_usd: plan.estimate });
   if (!creds) { await run.update({ status: 'skipped_no_credentials', finished_at: new Date().toJSON() }); return { runId: run.get('ID') as number, status: 'skipped_no_credentials', estimate: plan.estimate }; }
   const budget = settings.ai_monthly_budget_usd ?? 2;
   if (!budgetAllows(await monthSpend(), plan.estimate, budget)) {
      await run.update({ status: 'skipped_budget', finished_at: new Date().toJSON() });
      return { runId: run.get('ID') as number, status: 'skipped_budget', estimate: plan.estimate };
   }
   const week = weekOf(new Date());
   const runId = run.get('ID') as number;
   let cost = 0;

   // una semana = un dato: lo nuevo reemplaza lo de esta semana para esos prompts
   if (plan.prompts.length) {
      await AiAnswer.destroy({ where: { week, prompt_id: { [Op.in]: plan.prompts.map((p) => p.get('ID') as number) } } });
   }
   const jobs: (() => Promise<void>)[] = [];
   plan.prompts.forEach((p) => {
      const domain = p.get('domain') as string;
      const cfg = plan.cfgs.get(domain) as AiDomainSettings;
      const target = targetFor(cfg, p.get({ plain: true }));
      ENGINES.forEach((engine) => {
         for (let rep = 1; rep <= REPS; rep += 1) {
            jobs.push(async () => {
               const def = ENGINE_DEF[engine];
               const answer = await AiAnswer.create({ run_id: runId, prompt_id: p.get('ID'), domain, engine, rep, week, created_at: new Date().toJSON() });
               const useQueue = mode === 'queue' && !!def.post;
               const r = await dfsCall('POST', useQueue ? (def.post as string) : def.live, creds, [def.task(p.get('prompt') as string, target)]);
               cost += r.cost;
               await logUsage({ scraper: `ai:${engine}`, domain, keywordID: p.get('ID') as number, keyword: p.get('prompt') as string, depth: 0, costUSD: r.cost, triggeredBy, status: r.ok ? 'ok' : 'error' });
               if (!r.ok || !r.task) { await answer.update({ status: 'error', error: r.error || 'sin respuesta', cost_usd: r.cost }); return; }
               if (useQueue) { await answer.update({ task_id: r.task.id, cost_usd: r.cost }); return; }
               const result = r.task.result?.[0];
               if (!result) { await answer.update({ status: 'error', error: `${r.task.status_code} ${r.task.status_message}`, cost_usd: r.cost }); return; }
               await storeResult(answer, engine, result, r.cost, cfg);
            });
         }
      });
   });
   await pool(jobs);
   if (scope.kind === 'all' || scope.kind === 'google') {
      for (const d of plan.domains) {
         // eslint-disable-next-line no-await-in-loop
         const g = await runGoogleIa(d, creds, triggeredBy);
         cost += g.cost;
      }
   }
   const pending = await AiAnswer.count({ where: { run_id: runId, status: 'pending' } });
   await run.update({ cost_usd: cost, status: pending ? 'pending' : 'done', finished_at: pending ? null : new Date().toJSON() });
   return { runId, status: pending ? 'pending' : 'done', estimate: plan.estimate };
};

/** Recoge las tareas en cola que ya terminaron. Lo pendiente por más de 24 h pasa a error. */
export const collectPending = async (settings: SettingsType) => {
   const creds = settings.ai_dataforseo_credentials || '';
   const pending = await AiAnswer.findAll({ where: { status: 'pending', task_id: { [Op.ne]: '' } }, limit: 400 });
   const cfgs = await enabledDomains();
   let collected = 0; let errors = 0;
   await pool(pending.map((a) => async () => {
      const engine = a.get('engine') as Engine;
      const def = ENGINE_DEF[engine];
      const r = await dfsCall('GET', (def.get as (id: string) => string)(a.get('task_id') as string), creds);
      const code = r.task?.status_code;
      if (r.ok && code === 20000 && r.task.result?.[0]) {
         const cfg = cfgs.get(a.get('domain') as string) || parseAiSettings('', a.get('domain') as string);
         await storeResult(a, engine, r.task.result[0], 0, cfg); collected += 1; return;
      }
      const age = Date.now() - new Date(a.get('created_at') as string).getTime();
      if (age > 24 * 3600 * 1000 || (code && code >= 40000 && code !== 40602)) { // 40602 = "Task In Queue"
         await a.update({ status: 'error', error: r.error || `${code} ${r.task?.status_message}` }); errors += 1;
      }
   }));
   // cerrar corridas sin pendientes
   const runs = await AiRun.findAll({ where: { status: 'pending' } });
   for (const run of runs) {
      // eslint-disable-next-line no-await-in-loop
      const left = await AiAnswer.count({ where: { run_id: run.get('ID'), status: 'pending' } });
      // eslint-disable-next-line no-await-in-loop
      const errs = await AiAnswer.count({ where: { run_id: run.get('ID'), status: 'error' } });
      // eslint-disable-next-line no-await-in-loop
      if (!left) { await run.update({ status: errs ? 'partial' : 'done', finished_at: new Date().toJSON() }); }
   }
   // purga de raw con más de 26 semanas
   const limit = new Date(Date.now() - 26 * 7 * 24 * 3600 * 1000).toJSON();
   await AiAnswer.update({ raw: '' }, { where: { created_at: { [Op.lt]: limit }, raw: { [Op.ne]: '' } } });
   return { collected, errors };
};
```

> Verificar con el fixture de la Task 1 el código de estado de una tarea aún en cola (esperado `40602 Task In Queue` o `40601 Task Handed`); si es otro, ajustar la condición.

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/runner.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/aiVisibility/runner.ts __tests__/utils/aiVisibility/runner.test.ts
git commit -m "POLO-2026-11-04 (11): corredor de Visibilidad IA (cola semanal, recolección, en vivo, presupuesto)"
```

### Task 12: Rutas API y cron

**Files:**
- Create: `pages/api/ai-visibility/cron.ts`, `collect.ts`, `run.ts`, `prompts.ts`, `config.ts`, `data.ts`
- Modify: `cron.js`
- Test: `__tests__/utils/aiVisibility/data.test.ts`

**Interfaces:**
- Produces (HTTP):
  - `POST /api/ai-visibility/cron` (solo API key) → `startRun({kind:'all'}, 'queue', 'cron')` si `ai_weekly_enabled !== false`.
  - `POST /api/ai-visibility/collect` (solo API key) → `collectPending`.
  - `GET /api/ai-visibility/run?scope=prompt&id=3` → `{ estimate }` · `POST` mismo query → `startRun(..., 'live', 'user:<ID>')`. Scopes: `prompt&id`, `domain&domain`, `google&domain`.
  - `GET/POST/PUT/DELETE /api/ai-visibility/prompts?domain=` → CRUD; POST rechaza si ya hay `ai_max_prompts` activos (400 "Máximo N prompts por dominio").
  - `GET/PUT /api/ai-visibility/config?domain=` → lee/guarda `domain.ai_settings` (valida con `parseAiSettings`).
  - `GET /api/ai-visibility/data?domain=` → `AiVisibilityData` (abajo).
  - Función pura exportada desde `data.ts`: `buildPanel(prompts, answers, weeks): AiVisibilityData`.

```ts
export type EngineCell = { mentioned: number, total: number, bestPosition: number, cited: number };
export type AiVisibilityData = {
   lastRun: { started_at: string, status: string } | null,
   nextRun: string,                      // próximo lunes 09:00 UTC, ISO
   monthSpend: number, budget: number,
   totals: { answers: number, mentioned: number, cited: number, avgPosition: number },
   byEngine: Record<Engine, { prompts: number, promptsWithMention: number, answers: number, mentioned: number }>,
   prompts: { id: number, prompt: string, tags: string[], cells: Record<Engine, EngineCell>, topBrands: { name: string, count: number }[], deltaVsPrev: number | null }[],
   competitors: { name: string, total: number, byEngine: Record<Engine, number> }[],
   sources: Record<Engine, { domain: string, count: number }[]>,
   evolution: { week: string, ownRate: number, topCompetitor: string, competitorRate: number }[],
   detectedCompetitors: string[],
};
```

- [ ] **Step 1: Prueba que falla** — `buildPanel` con respuestas sintéticas:

```ts
/** @jest-environment node */
import { buildPanel } from '../../../pages/api/ai-visibility/data';

const ans = (engine: string, rep: number, mentioned: number, position: number, brands: string[]) => ({
   prompt_id: 1, engine, rep, week: '2026-11-09', status: 'ok', mentioned, cited: mentioned, position,
   brands: JSON.stringify(brands), sources: JSON.stringify([{ domain: 'ammo.cl', url: 'https://ammo.cl/', title: '' }]),
});

it('celda 3/3 · #1 y competidor contado', () => {
   const answers = [1, 2, 3].map((r) => ans('chatgpt', r, 1, 1, ['Ammo', 'Armario de la Karo']))
      .concat([1, 2, 3].map((r) => ans('perplexity', r, 0, 0, ['Armario de la Karo'])));
   const p = buildPanel([{ ID: 1, prompt: 'x', tags: '["arriendo"]' }] as any, answers as any, ['2026-11-09'], 'Ammo');
   expect(p.prompts[0].cells.chatgpt).toEqual({ mentioned: 3, total: 3, bestPosition: 1, cited: 3 });
   expect(p.prompts[0].cells.perplexity.mentioned).toBe(0);
   expect(p.competitors[0]).toMatchObject({ name: 'Armario de la Karo', total: 6 });
   expect(p.byEngine.chatgpt).toMatchObject({ prompts: 1, promptsWithMention: 1, answers: 3, mentioned: 3 });
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/utils/aiVisibility/data.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** Todas las rutas empiezan igual que `pages/api/ai-tracking.ts` (`await db.sync(); authenticate; canAccessDomain`). `cron.ts` y `collect.ts` exigen `auth.viaApiKey || isSuperadmin(auth.user)`, como `pages/api/cron.ts`. `run.ts` y escrituras de `prompts.ts`/`config.ts` exigen `canAccessDomain`.

`data.ts` — `buildPanel(prompts, answers, weeks, ownName)`: usa solo respuestas `status === 'ok'` de la **semana más reciente** (`weeks[0]`) para tabla, tarjetas, competencia y fuentes; `evolution` recorre `weeks` (hasta 12, más reciente primero → invertir) calculando `ownRate = mentioned/answers` y el competidor con más menciones del total; `deltaVsPrev` = menciones del prompt en `weeks[0]` − en `weeks[1]` (null si no hay semana anterior). `topBrands` = conteo de `brands` excluyendo `ownName`, top 4. `detectedCompetitors` = `newCompetitors` sobre las `brands` de ChatGPT de la última semana. El handler `GET` arma `weeks` con `SELECT DISTINCT week FROM ai_answer WHERE domain=? ORDER BY week DESC LIMIT 12`, lee `monthSpend()`, el último `AiRun`, y `nextRun` = próximo lunes 09:00 UTC.

`cron.js`, dentro de `runAppCronJobs`, después del bloque de auditoría:
```js
      // PoloRank — Visibilidad IA: corrida semanal (lunes 06:00 Chile = 09:00 UTC) y recolector de la cola cada 10 min
      const aiOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
      new Cron('0 0 9 * * 1', () => {
         fetch(`${INTERNAL_BASE_URL}/api/ai-visibility/cron`, aiOpts).then((r) => r.json())
            .then((d) => console.log('[VISIBILIDAD IA] Corrida semanal:', JSON.stringify(d)))
            .catch((err) => console.log('ERROR Visibilidad IA cron', err));
      }, { scheduled: true, timezone: 'UTC' });
      new Cron('0 */10 * * * *', () => {
         fetch(`${INTERNAL_BASE_URL}/api/ai-visibility/collect`, aiOpts).then((r) => r.json())
            .then((d) => { if (d.collected || d.errors) { console.log('[VISIBILIDAD IA] Recolección:', JSON.stringify(d)); } })
            .catch((err) => console.log('ERROR Visibilidad IA collect', err));
      }, { scheduled: true });
```

- [ ] **Step 4:** `npx jest --ci __tests__/utils/aiVisibility/` → PASS; `npx tsc --noEmit` → OK.

- [ ] **Step 5: Commit**

```bash
git add pages/api/ai-visibility cron.js __tests__/utils/aiVisibility/data.test.ts
git commit -m "POLO-2026-11-04 (12): rutas de Visibilidad IA y cron semanal + recolector"
```

### Task 13: Carga de los 30 prompts (solo Ammo encendido)

**Files:**
- Create: `database/migrations/1787600000010-seed-ai-prompts.js`

- [ ] **Step 1: Escribir la migración** (idempotente: no inserta si el dominio ya tiene prompts; solo escribe `ai_settings` si está vacío o `{}`):

```js
// PoloRank migration: prompts iniciales de Visibilidad IA aprobados por Fabián el 2026-11-04 (spec §12).
// Encendido gradual: solo ammo.cl queda enabled. Los demás quedan cargados y apagados.
const D = {
   'ammo.cl': {
      cfg: { enabled: true, brand_variants: ['Ammo', 'Ammo Store'], brand_urls: ['ammo.cl', 'instagram.com/ammostorechile'],
         competitors: [{ name: 'Armario de la Karo', variants: [] }, { name: 'Blanka Atelier', variants: ['Blanka'] },
            { name: 'Yaskari Novias y Fiestas', variants: ['Yaskari'] }, { name: 'Lady Lorenz', variants: [] },
            { name: 'Divina Novias', variants: [] }, { name: "Vestidos D'Fiesta", variants: ['DFiesta'] }],
         location_code: 2152, language_code: 'es', gemini_location_code: 20153, country_iso: 'CL' },
      prompts: [
         ['¿Qué tiendas en Temuco venden vestidos de fiesta bonitos y de buena calidad?', ['venta']],
         ['¿Dónde encuentro vestidos de gala en Temuco?', ['gala']],
         ['¿Dónde puedo arrendar un vestido de fiesta en Temuco?', ['arriendo']],
         ['¿Dónde compro un vestido para mi graduación en Temuco?', ['graduación']],
         ['¿Dónde encuentro un vestido para la fiesta de fin de año de mi empresa en Temuco?', ['fin de año']],
      ],
   },
   'mavae.cl': {
      cfg: { enabled: false, brand_variants: ['Mavae'], brand_urls: ['mavae.cl'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Qué empresas de regalos corporativos recomiendas en Chile?', ['regalos corporativos']],
         ['¿Dónde mando a hacer merchandising corporativo con el logo de mi empresa en Chile?', ['merchandising']],
         ['¿Qué proveedor hace bolsas personalizadas con logo en Chile?', ['bolsas']],
         ['Necesito regalos corporativos personalizados para clientes, ¿qué empresa en Santiago me recomiendas?', ['personalizados']],
         ['¿Qué regalos corporativos de Navidad puedo dar a mis clientes y dónde los compro en Chile?', ['navidad']],
      ],
   },
   'maderasfresard.com': {
      cfg: { enabled: false, brand_variants: ['Fresard', 'Maderas Fresard'], brand_urls: ['maderasfresard.com'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Dónde compro madera de roble en el sur de Chile?', ['roble']],
         ['¿Qué aserraderos venden maderas del sur de Chile al por mayor?', ['mayorista']],
         ['¿Dónde puedo comprar madera de raulí en Chile?', ['raulí']],
         ['¿Quién vende madera de coihue en la Araucanía?', ['coihue']],
         ['¿Dónde compro madera de pino oregón seca en Chile?', ['pino oregón']],
      ],
   },
   'emignia.com': {
      cfg: { enabled: false, brand_variants: ['Emignia'], brand_urls: ['emignia.com'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Qué agencia SEO recomiendas en Chile?', ['seo']],
         ['¿Qué agencia de marketing digital en Chile me recomiendas para una pyme?', ['marketing digital']],
         ['¿Qué empresa recomiendas para hacer el diseño de la página web de mi empresa en Chile?', ['diseño web']],
         ['¿Qué agencia puede posicionar mi negocio en Google y en ChatGPT en Chile?', ['seo ia']],
         ['Qual agência de SEO você recomenda para minha empresa?', ['brasil'], { location_code: 2076, language_code: 'pt', country_iso: 'BR' }],
      ],
   },
   'thetravellab.cl': {
      cfg: { enabled: false, brand_variants: ['The Travel Lab', 'TheTravelLab'], brand_urls: ['thetravellab.cl'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL' },
      prompts: [
         ['¿Qué agencia de viajes en Chile recomiendas para comprar un paquete a Brasil?', ['brasil']],
         ['¿Dónde compro un paquete a Río de Janeiro desde Chile con vuelo y hotel?', ['rio']],
         ['¿Qué agencia de viajes en Chile es confiable para viajar al extranjero?', ['agencia']],
         ['¿Dónde encuentro paquetes a Florianópolis desde Santiago?', ['florianópolis']],
         ['Quiero ir a Brasil en verano con mi familia, ¿qué agencia en Chile me arma el viaje?', ['familia']],
      ],
   },
   'thetravellab.com.br': {
      cfg: { enabled: false, brand_variants: ['The Travel Lab', 'TheTravelLab'], brand_urls: ['thetravellab.com.br'], competitors: [], location_code: 2076, language_code: 'pt', country_iso: 'BR' },
      prompts: [
         ['Qual agência de viagem você recomenda para uma viagem para o Chile?', ['chile']],
         ['Onde compro um pacote de viagem para o Chile com hotel e passeios?', ['pacote']],
         ['Qual agência vende pacote para Santiago do Chile saindo do Brasil?', ['santiago']],
         ['Vale a pena conhecer Pucón no Chile? Qual agência organiza a viagem?', ['pucón']],
         ['Quero viajar para o Chile com minha família, qual agência monta o roteiro?', ['família']],
      ],
   },
};

module.exports = {
   up: (queryInterface) => queryInterface.sequelize.transaction(async (t) => {
      const now = new Date().toJSON();
      for (const [domain, { cfg, prompts }] of Object.entries(D)) {
         // eslint-disable-next-line no-await-in-loop
         const [dom] = await queryInterface.sequelize.query('SELECT ai_settings FROM domain WHERE domain = ?', { replacements: [domain], transaction: t });
         if (!dom.length) { console.log(`[MIGRACIÓN] ${domain} no existe, se omite`); continue; }
         if (!dom[0].ai_settings || dom[0].ai_settings === '{}') {
            // eslint-disable-next-line no-await-in-loop
            await queryInterface.sequelize.query('UPDATE domain SET ai_settings = ? WHERE domain = ?', { replacements: [JSON.stringify(cfg), domain], transaction: t });
         }
         // eslint-disable-next-line no-await-in-loop
         const [[{ n }]] = await queryInterface.sequelize.query('SELECT COUNT(*) AS n FROM ai_prompt WHERE domain = ?', { replacements: [domain], transaction: t });
         if (n > 0) { continue; }
         for (const [prompt, tags, o = {}] of prompts) {
            // eslint-disable-next-line no-await-in-loop
            await queryInterface.sequelize.query(
               'INSERT INTO ai_prompt (domain, prompt, tags, active, location_code, language_code, country_iso, created_at) VALUES (?,?,?,1,?,?,?,?)',
               { replacements: [domain, prompt, JSON.stringify(tags), o.location_code || null, o.language_code || null, o.country_iso || null, now], transaction: t },
            );
         }
      }
      console.log('[MIGRACIÓN] Visibilidad IA: prompts iniciales cargados (solo ammo.cl encendido)');
   }),
   down: async () => { console.log('[MIGRACIÓN] La reversa no borra prompts: se apagan desde la configuración.'); },
};
```

- [ ] **Step 2:** `npx sequelize-cli db:migrate` sobre la copia local → `sqlite3 data/database.sqlite "select domain, count(*) from ai_prompt group by domain"` → 6 filas con 5 c/u; `select domain, json_extract(ai_settings,'$.enabled') from domain where ai_settings != '{}'` → solo ammo.cl = 1.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/1787600000010-seed-ai-prompts.js
git commit -m "POLO-2026-11-04 (13): 30 prompts iniciales, solo ammo.cl encendido"
```

---

# ETAPA 4 — Asistentes IA (interfaz)

### Task 14: Servicios cliente y pestaña

**Files:**
- Create: `services/aiVisibility.tsx`
- Modify: `components/domains/DomainHeader.tsx` (texto "Tracking IA" → "Visibilidad IA", título de ayuda "Asistentes IA y resumen con IA de Google"), `pages/ai-tracking/[slug]/index.tsx` (conmutador de vistas)

**Interfaces:**
- Produces: `useFetchAiVisibility(domain)`, `useAiRunEstimate()`, `useRunAiNow()`, `useAiPrompts(domain)`, `useSaveAiPrompt()`, `useDeleteAiPrompt()`, `useAiConfig(domain)`, `useSaveAiConfig()` (react-query, mismo patrón que `services/aiTracking.tsx`; las mutaciones invalidan `['aiVisibility', domain]`).

- [ ] **Step 1:** Escribir `services/aiVisibility.tsx` con los hooks (fetch a las rutas de la Task 12; `toast` de `react-hot-toast` en error, como `services/domains.tsx`).
- [ ] **Step 2:** En `pages/ai-tracking/[slug]/index.tsx` agregar `const [view, setView] = useState<'assistants' | 'google'>('assistants');`, el conmutador de dos botones de la maqueta ("Asistentes IA (prompts)" / "Google IA (palabras clave)") y renderizar `<AssistantsView domain=… />` o el `<AiTrackingTable … />` existente.
- [ ] **Step 3:** `npx tsc --noEmit` y `npm run lint` → sin errores nuevos.
- [ ] **Step 4: Commit** `POLO-2026-11-04 (14): pestaña Visibilidad IA con vistas Asistentes y Google IA`

### Task 15: Vista Asistentes IA

**Files:**
- Create: `components/aivisibility/AssistantsView.tsx` (orquesta), `SummaryCards.tsx`, `EngineCards.tsx`, `PromptsTable.tsx`, `PromptDetail.tsx`, `CompetitorsTable.tsx`, `SourcesGrid.tsx`, `EvolutionChart.tsx`, `RunNowButton.tsx`
- Test: `__tests__/components/aivisibility/PromptsTable.test.tsx`

**Interfaces:** Consume `AiVisibilityData` (Task 12). Diseño = `../respaldos/piloto-ia-2026-11-04/maqueta-visibilidad-ia.html` (copiar clases Tailwind de ahí).

- [ ] **Step 1: Prueba que falla**

```tsx
import { render, screen } from '@testing-library/react';
import PromptsTable from '../../../components/aivisibility/PromptsTable';

const cell = (m: number, p: number) => ({ mentioned: m, total: 3, bestPosition: p, cited: m });
it('muestra 3/3 · #1 y 0/3 en rojo', () => {
   render(<PromptsTable prompts={[{ id: 1, prompt: '¿Dónde arriendo?', tags: ['arriendo'],
      cells: { chatgpt: cell(3, 1), gemini: cell(3, 1), ai_mode: cell(2, 2), perplexity: cell(0, 0) },
      topBrands: [{ name: 'Armario de la Karo', count: 6 }], deltaVsPrev: null }]} activeTag='' onRun={() => {}} />);
   expect(screen.getAllByText('3/3 · #1')).toHaveLength(2);
   expect(screen.getByText('0/3')).toHaveClass('text-red-700');
   expect(screen.getByText(/Armario de la Karo \(6\)/)).toBeInTheDocument();
});
```

- [ ] **Step 2:** `npx jest --ci __tests__/components/aivisibility/PromptsTable.test.tsx` → FAIL.

- [ ] **Step 3: Implementar** los componentes. Reglas de la maqueta:
  - Celda: `${mentioned}/${total}` + (`bestPosition` ? ` · #${bestPosition}` : ''); verde (`bg-green-100 text-green-700`) si `bestPosition === 1`, amarillo (`bg-yellow-100 text-yellow-800`) si mentioned>0 y posición>1, rojo (`bg-red-100 text-red-700`) si 0, gris `—` si `total === 0`.
  - `EngineCards`: "N de M prompts" grande + "X de Y respuestas" pequeño debajo (corrección pedida por Fabián el 2026-11-04).
  - `SummaryCards`: "Te nombran X / Y", "Te citan como fuente X / Y", "Lugar promedio #N", "Competidor principal".
  - `PromptDetail` (al expandir): por motor, extracto (primeros 280 caracteres alrededor de la primera mención de la marca, o del inicio), "Buscó por dentro" (fan_out), fuentes (5 + "+N") y enlace "Ver las 3 respuestas completas" que abre un modal con `text` de cada repetición (pedirlo a `GET /api/ai-visibility/data?domain=&prompt=<id>&full=1`, que devuelve las 12 respuestas de la última semana).
  - `RunNowButton`: al hacer clic pide `GET /run` (estimado) y muestra "Esto cuesta ~US$X. ¿Actualizar ahora?" en un modal propio (no `window.confirm`); al confirmar, `POST /run`.
  - Cabecera: "Última medición: …  · Próxima: lun DD-MMM 06:00 · Semanal · 3 repeticiones" y, si `lastRun.status === 'skipped_budget'`, franja ámbar "Se alcanzó el tope mensual (US$X de US$Y). La corrida se pausó."
  - `EvolutionChart`: SVG simple (como la maqueta), línea propia azul y competidor gris punteada; sin librería nueva.

- [ ] **Step 4:** `npx jest --ci __tests__/components/aivisibility/` → PASS; `npm run lint` → OK.
- [ ] **Step 5: Commit** `POLO-2026-11-04 (15): vista Asistentes IA según maqueta`

### Task 16: Configuración por dominio

**Files:**
- Create: `components/aivisibility/AiConfigModal.tsx`
- Test: `__tests__/components/aivisibility/AiConfigModal.test.tsx`

- [ ] **Step 1: Prueba que falla** — con 5 prompts activos y `maxPrompts={5}`, el botón "+ Agregar prompt" está deshabilitado y muestra "Máximo 5 prompts".
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: Implementar** el modal (abre desde "⚙ Prompts y competidores"): lista de prompts (editar texto ≤500, etiquetas separadas por coma, activo sí/no, borrar); variantes de marca y URLs propias (una por línea); competidores (nombre + variantes); país/idioma del dominio (selector Chile 2152/es/CL · Brasil 2076/pt/BR) y región de Gemini opcional; interruptor "Medir este dominio" (`enabled`). Debajo de competidores, chips de `detectedCompetitors` con "+ agregar".
- [ ] **Step 4:** pruebas → PASS; lint → OK.
- [ ] **Step 5: Commit** `POLO-2026-11-04 (16): configuración de prompts, marca y competidores`

### Task 17: Verificación completa y registro

- [ ] **Step 1:** `npx jest --ci` (suite completa) → todo PASS. `npx tsc --noEmit` y `npm run lint` → sin errores. `npm run build` → OK.
- [ ] **Step 2:** Prueba local de punta a punta con la copia de la base: `npm run dev`, poner `ai_dataforseo_credentials` en Settings, tope US$2, en la pestaña de ammo.cl presionar "Actualizar ahora" para **un solo prompt** (~US$0,05). Comparar con el piloto del 04-nov: ChatGPT/Gemini deben nombrar a Ammo. Revisar `api_usage` (`scraper like 'ai:%'`) y el costo real.
- [ ] **Step 3:** Agregar a `docs/REGISTRO-DE-CAMBIOS.md` la fila `POLO-2026-11-04-01` (Visibilidad IA) con: qué cambió, migraciones 09 y 10, costo esperado por corrida (~US$0,18 solo Ammo), encendido gradual y cómo revertir (apagar `ai_weekly_enabled`; revertir el commit no requiere tocar la base).
- [ ] **Step 4: Commit** `docs: registrar POLO-2026-11-04-01 Visibilidad IA`
- [ ] **Step 5: 🔐 Publicación** — **detenerse y pedir OK a Fabián** antes de `git push` (auto-deploy). Respaldo previo de la base de producción (3 archivos, como en POLO-2026-10-31-01). Después del deploy: poner las credenciales IA en Settings de producción (Fabián o con su OK), lanzar "Actualizar ahora" de un prompt de Ammo, y esperar la corrida del lunes.
- [ ] **Step 6:** Tras la primera corrida semanal limpia de Ammo → con OK de Fabián, encender maderasfresard.com; tras una corrida limpia de ambos → los 4 restantes y tope a US$10.
