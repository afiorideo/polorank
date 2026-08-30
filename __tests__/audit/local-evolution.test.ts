import localChecks, { localSchemaCheck, localCityCheck, localPackRateCheck, localPhoneCheck } from '../../utils/audit/checks/local';
import { diffChecks, positionOn, positionMoves } from '../../utils/audit/evolution';
import type { AuditInput, CrawledPage, AuditKeyword } from '../../utils/audit/types';
import type { ParsedPage } from '../../utils/audit/parse';

const parsed = (over: Partial<ParsedPage> = {}): ParsedPage => ({
   title: '',
   metaDescription: '',
   h1: [],
   h2: [],
   canonical: '',
   indexable: true,
   robotsMeta: '',
   wordCount: 0,
   wordCountAll: 0,
   images: 0,
   imagesWithoutAlt: 0,
   internalLinks: [],
   externalLinks: 0,
   schemaTypes: [],
   telLinks: 0,
   whatsappLinks: 0,
   hasForm: false,
   lang: 'es',
   ...over,
});

const home = (over: Partial<CrawledPage> = {}): CrawledPage => ({
   url: 'https://x.cl/',
   statusCode: 200,
   fetchedOk: true,
   title: '',
   h1: [],
   wordCount: 400,
   clickDepth: 0,
   indexable: true,
   sizeBytes: 40000,
   internalLinks: [],
   parsed: parsed(),
   ...over,
});

const kw = (over: Partial<AuditKeyword>): AuditKeyword => ({
   keyword: '',
   targetUrl: '',
   rankingUrl: '',
   position: 0,
   targetPosition: 0,
   volume: 0,
   serpFeatures: [],
   serpTop: [],
   ...over,
});

const input = (over: Partial<AuditInput>): AuditInput => ({
   domain: 'x.cl', profile: 'local', pages: [home()], keywords: [], ...over,
});

describe('auditoría · bloque Local', () => {
   it('caso real de Fresard: declara LocalBusiness dentro de un array en @graph', () => {
      const p = home({ parsed: parsed({ schemaTypes: ['LocalBusiness', 'Organization', 'WebSite'] }) });
      const out = localSchemaCheck.run(input({ pages: [p], home: p }));
      expect(out[0].status).toBe('pass');
      expect(out[0].evidence).toMatchObject({ tiposLocales: ['LocalBusiness'] });
   });

   it('sin ciudad configurada NO reprueba: dice qué falta configurar', () => {
      const out = localCityCheck.run(input({}));
      expect(out[0].status).toBe('na');
      expect(String((out[0].evidence as any).motivo)).toContain('ciudad configurada');
   });

   it('con la ciudad configurada, la busca en el title y el H1', () => {
      const p = home({ title: 'Maderas del Sur de Chile en Villarrica', h1: ['Venta de maderas'] });
      expect(localCityCheck.run(input({ pages: [p], home: p, cities: ['Villarrica'] }))[0].status).toBe('pass');
      expect(localCityCheck.run(input({ pages: [p], home: p, cities: ['Temuco'] }))[0].status).toBe('fail');
   });

   it('caso real de Fresard: sin teléfono ni WhatsApp en la home', () => {
      expect(localPhoneCheck.run(input({}))[0].status).toBe('fail');
      const conTel = home({ parsed: parsed({ telLinks: 1 }) });
      expect(localPhoneCheck.run(input({ pages: [conTel], home: conTel }))[0].status).toBe('pass');
   });

   it('la tasa de mapa local es contexto, no aprueba ni reprueba', () => {
      const kws = [kw({ serpFeatures: ['local_pack'] }), kw({ serpFeatures: [] }), kw({ serpFeatures: [] }), kw({ serpFeatures: [] })];
      const out = localPackRateCheck.run(input({ keywords: kws }));
      expect(out[0].status).toBe('pass');
      expect(out[0].evidence).toMatchObject({ porcentaje: 25, busquedasConMapaLocal: 1, deUnTotalDe: 4 });
   });

   it('sin SERPs guardadas, la tasa no se inventa', () => {
      expect(localPackRateCheck.run(input({ keywords: [] }))[0].status).toBe('na');
   });

   it('todos los checks de Local tienen id, peso y ayuda', () => {
      expect(localChecks).toHaveLength(5);
      localChecks.forEach((c) => expect(c.block).toBe('local'));
   });
});

describe('auditoría · evolución entre corridas', () => {
   const c = (checkId: string, status: string, url = '') => ({ checkId, block: 'onpage', url, status });

   it('detecta lo que se arregló y lo que se rompió', () => {
      const antes = [c('onp.title', 'fail'), c('onp.h1.unique', 'pass')];
      const ahora = [c('onp.title', 'pass'), c('onp.h1.unique', 'fail')];
      const d = diffChecks(antes, ahora);
      expect(d).toEqual(expect.arrayContaining([
         expect.objectContaining({ checkId: 'onp.title', kind: 'fixed' }),
         expect.objectContaining({ checkId: 'onp.h1.unique', kind: 'broke' }),
      ]));
   });

   it('un check nuevo del catálogo se marca NUEVO, no "antes fallaba"', () => {
      const d = diffChecks([], [c('loc.schema', 'fail')]);
      expect(d[0]).toMatchObject({ kind: 'new', before: null });
   });

   it('ignora los cambios entre estados que no son pasa/no pasa', () => {
      expect(diffChecks([c('a.b', 'na')], [c('a.b', 'pending_review')])).toHaveLength(0);
   });

   it('positionOn toma el día más cercano dentro de la tolerancia', () => {
      const h = { '2026-8-10': 5, '2026-8-20': 3 };
      expect(positionOn(h, '2026-08-20T00:00:00Z')).toBe(3);
      expect(positionOn(h, '2026-08-11T00:00:00Z')).toBe(5);
      expect(positionOn(h, '2026-08-15T00:00:00Z')).toBeNull();
   });

   it('no inventa magnitud cuando una punta no estaba posicionada', () => {
      const kws = [
         { keyword: 'sube', history: { '2026-8-10': 12, '2026-8-20': 4 } },
         { keyword: 'aparece', history: { '2026-8-10': 0, '2026-8-20': 8 } },
      ];
      const m = positionMoves(kws, '2026-08-10T00:00:00Z', '2026-08-20T00:00:00Z');
      expect(m[0].change).toBe(8);
      expect(m[1].change).toBeNull(); // estaba fuera: no hay diferencia que calcular
   });
});
