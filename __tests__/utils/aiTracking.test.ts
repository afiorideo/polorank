import { citationRatio, citationPeriods, parseKey, brandOf, mentionState, MIN_BRAND_LENGTH } from '../../utils/aiTracking';
import type { DailyCite } from '../../utils/aiTracking';

const HOY = new Date(2026, 8, 28); // 28 de septiembre de 2026
const dia = (d: number, estado: number): DailyCite => ({ date: `2026-9-${d}`, ai_cited: estado });

describe('Tracking IA · proporción de citas', () => {
   it('cuenta citas sobre oportunidades, no sobre días del calendario', () => {
      // 7 días medidos para que la ventana de 7 esté cubierta: 3 con resumen (2 citado, 1 no)
      const rows = [dia(28, 1), dia(27, 1), dia(26, 0), dia(25, -1), dia(24, -1), dia(23, -1), dia(22, 0)];
      expect(citationRatio(rows, 7, HOY)).toMatchObject({ cited: 2, days: 7, withAi: 4 });
   });

   it('REGLA: un período sin datos de esa antigüedad devuelve null — nada de repetir el mismo número', () => {
      // un solo día medido: las cuatro ventanas lo contienen, pero ninguna está cubierta salvo la de 1 día
      const unDia = [dia(28, 0)];
      expect(citationRatio(unDia, 7, HOY)).toBeNull();
      expect(citationRatio(unDia, 30, HOY)).toBeNull();
      expect(citationRatio(unDia, 90, HOY)).toBeNull();
      expect(citationRatio(unDia, 1, HOY)).toMatchObject({ cited: 0, days: 1, withAi: 1 });
   });

   it('el período se activa recién cuando la serie llega a su comienzo', () => {
      const sieteDias = [22, 23, 24, 25, 26, 27, 28].map((d) => dia(d, 0));
      expect(citationRatio(sieteDias, 7, HOY)).toMatchObject({ cited: 0, days: 7, withAi: 7 });
      expect(citationRatio(sieteDias, 30, HOY)).toBeNull();
   });

   it('REGLA: los días sin resumen no cuentan ni a favor ni en contra', () => {
      const conHuecos = [dia(28, 1), dia(27, -1), dia(26, -1), dia(25, -1), dia(24, -1), dia(23, -1), dia(22, 1)];
      expect(citationRatio(conHuecos, 7, HOY)).toMatchObject({ cited: 2, days: 7, withAi: 2 });
   });

   it('devuelve null cuando no hubo ni una oportunidad en el período', () => {
      expect(citationRatio([dia(28, -1), dia(27, -1)], 7, HOY)).toBeNull();
      expect(citationRatio([], 7, HOY)).toBeNull();
   });

   it('cero citas con oportunidades es 0 de N, que no es lo mismo que null', () => {
      const semana = [22, 23, 24, 25, 26, 27, 28].map((d) => dia(d, 0));
      expect(citationRatio(semana, 7, HOY)).toMatchObject({ cited: 0, days: 7, withAi: 7 });
   });

   it('ignora lo que cae fuera de la ventana', () => {
      const viejo = [{ date: '2026-7-1', ai_cited: 1 }, dia(28, 0)];
      expect(citationRatio(viejo, 7, HOY)).toMatchObject({ cited: 0, days: 7, withAi: 1 });
      expect(citationRatio(viejo, 90, HOY)).toMatchObject({ cited: 1, days: 90, withAi: 2 });
   });

   it('caso real de hoy: Madera de Roble con un solo día medido muestra guion en los cuatro períodos', () => {
      const p = citationPeriods([dia(28, 0)], HOY);
      expect([p.d7, p.d30, p.d60, p.d90]).toEqual([null, null, null, null]);
   });

   it('la ventana de 7 días incluye hoy y los 6 anteriores', () => {
      const rows = [dia(28, 1), dia(22, 1), dia(21, 1)];
      expect(citationRatio(rows, 7, HOY)).toMatchObject({ cited: 2, days: 7, withAi: 2 }); // 28 y 22, no el 21
   });

   it('tolera fechas con formato roto sin romperse', () => {
      const rows = [{ date: 'basura', ai_cited: 1 }, dia(28, 1), dia(22, 1)];
      expect(citationRatio(rows, 7, HOY)).toMatchObject({ cited: 2, days: 7 });
   });

   it('citationPeriods arma los cuatro períodos de la tabla', () => {
      // serie que llega a agosto: 7 y 30 quedan cubiertos, 60 y 90 todavía no
      const p = citationPeriods([dia(28, 1), dia(20, 0), { date: '2026-8-30', ai_cited: 1 }], HOY);
      expect(p.d7).toMatchObject({ cited: 1, days: 7, withAi: 1 });
      expect(p.d30).toMatchObject({ cited: 2, days: 30, withAi: 3 });
      expect(p.d60).toBeNull();
      expect(p.d90).toBeNull();
   });

   it('sin ninguna medición de IA, los cuatro períodos son null', () => {
      expect(citationPeriods([], HOY).d90).toBeNull();
      expect(citationPeriods([dia(28, -1), dia(27, -1)], HOY).d7).toBeNull();
   });
});

describe('Tracking IA · bordes de ventana con cambio de hora', () => {
   it('REGLA: la ventana se calcula por calendario, no restando 24 h por día', () => {
      // en septiembre Chile cambia la hora: restar 30 x 24 h cae a las 23:00 del dia anterior
      const treintaDias = [{ date: '2026-8-30', ai_cited: 1 }, dia(28, 0)];
      expect(citationRatio(treintaDias, 30, HOY)).toMatchObject({ cited: 1, days: 30, withAi: 2 });
   });
});

describe('Tracking IA · orden de fechas', () => {
   it('REGLA: las claves YYYY-M-D no se ordenan como texto', () => {
      // sin cero adelante, '2026-9-9' > '2026-9-28' al comparar caracteres
      expect('2026-9-9'.localeCompare('2026-9-28')).toBeGreaterThan(0);
      // con el parseo real, el 28 es posterior
      expect(parseKey('2026-9-28')).toBeGreaterThan(parseKey('2026-9-9'));
   });

   it('ordena correctamente un mes con días de uno y dos dígitos', () => {
      const fechas = ['2026-9-9', '2026-9-28', '2026-9-1', '2026-10-2'];
      const ordenadas = [...fechas].sort((a, b) => parseKey(a) - parseKey(b));
      expect(ordenadas).toEqual(['2026-9-1', '2026-9-9', '2026-9-28', '2026-10-2']);
   });
});

describe('Tracking IA · menciones en el texto', () => {
   it('la marca sale del dominio cuando no hay una configurada', () => {
      expect(brandOf('maderasfresard.com')).toBe('maderasfresard');
      expect(brandOf('www.ammo.cl')).toBe('ammo');
      expect(brandOf('https://thetravellab.com.br')).toBe('thetravellab');
   });

   it('una marca configurada manda sobre el dominio', () => {
      expect(brandOf('maderasfresard.com', 'Fresard')).toBe('fresard');
      expect(brandOf('maderasfresard.com', '  ')).toBe('maderasfresard');
   });

   it('caso real: el resumen de "madera de roble" nombra a Tranapuente y a Sodimac, no a Fresard', () => {
      const texto = 'La madera de roble es dura. Marcas como Sodimac y MADERAS TRANAPUENTE la distribuyen.';
      expect(mentionState(texto, 'tranapuente')).toBe(1);
      expect(mentionState(texto, 'sodimac')).toBe(1);
      expect(mentionState(texto, 'maderasfresard')).toBe(0);
      expect(mentionState(texto, 'wmaderas')).toBe(0);
   });

   it('sin resumen no se puede saber: -1, no 0', () => {
      expect(mentionState(null, 'fresard')).toBe(-1);
      expect(mentionState(undefined, 'fresard')).toBe(-1);
   });

   it('REGLA: una marca muy corta no se busca, porque daría un sí falso', () => {
      expect(MIN_BRAND_LENGTH).toBe(4);
      // "ivo" aparece dentro de "efectivo", "motivo", "vivo"...
      expect(mentionState('Es un material muy efectivo y resistente', 'ivo')).toBe(-1);
      expect(mentionState('Es un material muy efectivo', 'ammo')).toBe(0);
   });

   it('un resumen vacío es 0: hubo resumen y no nombra a nadie', () => {
      expect(mentionState('', 'fresard')).toBe(0);
   });
});
