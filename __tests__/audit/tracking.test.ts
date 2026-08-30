import { targetReachable, targetTitle, cannibalisation, MIN_VALUE_RATIO } from '../../utils/audit/checks/tracking';
import type { AuditInput, AuditKeyword, CrawledPage } from '../../utils/audit/types';

const page = (url: string, title: string, over: Partial<CrawledPage> = {}): CrawledPage => ({
   url,
title,
statusCode: 200,
fetchedOk: true,
h1: [],
wordCount: 500,
clickDepth: 0,
indexable: true,
   sizeBytes: 50000,
internalLinks: [],
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
   domain: 'ammo.cl', profile: 'local_national', pages: [], keywords: [], ...over,
});

describe('auditoría · checks que cruzan con el tracking', () => {
   describe('arq.target.reachable', () => {
      it('detecta el caso real de ammo: Google muestra la home en vez de la landing', () => {
         const out = targetReachable.run(input({
            keywords: [kw({
               keyword: 'vestidos de graduación en temuco',
               targetUrl: 'https://ammo.cl/vestidos-de-graduacion-en-temuco/',
               rankingUrl: 'https://ammo.cl/',
               position: 2,
            })],
         }));
         expect(out[0].status).toBe('fail');
         expect(out[0].evidence).toMatchObject({ objetivo: expect.stringContaining('graduacion'), rankea: 'https://ammo.cl/', posicion: 2 });
      });

      it('pasa cuando rankea la página que definiste, ignorando la barra final y el protocolo', () => {
         const out = targetReachable.run(input({
            keywords: [kw({
               keyword: 'arriendo vestidos de fiesta temuco',
               targetUrl: 'https://ammo.cl/arriendo-de-vestidos-en-temuco/',
               rankingUrl: 'http://ammo.cl/arriendo-de-vestidos-en-temuco',
               position: 1,
            })],
         }));
         expect(out[0].status).toBe('pass');
      });

      it('no puntúa cuando falta la URL objetivo: es un dato que no tenemos, no un fallo', () => {
         const out = targetReachable.run(input({ keywords: [kw({ keyword: 'vestidos de fiesta temuco', rankingUrl: 'https://ammo.cl/', position: 2 })] }));
         expect(out[0].status).toBe('na');
      });

      it('no puntúa cuando el dominio no aparece: no se puede comparar contra nada', () => {
         const out = targetReachable.run(input({
            keywords: [kw({ keyword: 'vestidos para fiesta de fin de año', targetUrl: 'https://ammo.cl/fin-de-ano/', rankingUrl: '', position: 0 })],
         }));
         expect(out[0].status).toBe('na');
      });
   });

   describe('onp.target.title', () => {
      it('caso real de Fresard: el title contiene la frase de 590, así que pasa — y está bien que pase', () => {
         const out = targetTitle.run(input({
            domain: 'maderasfresard.com',
            pages: [page('https://maderasfresard.com/', 'Maderas del Sur de Chile en Villarrica | Maderas Fresard')],
            keywords: [
               kw({ keyword: 'Maderas del Sur de Chile', targetUrl: 'https://maderasfresard.com/', volume: 20 }),
               kw({ keyword: 'Maderas del Sur', targetUrl: 'https://maderasfresard.com/', volume: 590 }),
            ],
         }));
         expect(out).toHaveLength(1);
         // "Maderas del Sur de Chile" contiene la frase "Maderas del Sur": el title sí apunta a la de 590
         expect(out[0].status).toBe('pass');
         expect(out[0].evidence).toMatchObject({ enElTitle: { keyword: 'Maderas del Sur', volumen: 590 } });
      });

      it('LÍMITE CONOCIDO: no ve la oportunidad que no estás siguiendo', () => {
         // "barraca de maderas" tiene 1.900 búsquedas y no aparece en el sitio, pero como no está en seguimiento
         // este check no puede saberlo. Ese hallazgo necesita candidatas de Keyword Planner (onp.title.opportunity).
         const out = targetTitle.run(input({
            domain: 'maderasfresard.com',
            pages: [page('https://maderasfresard.com/', 'Maderas del Sur de Chile en Villarrica | Maderas Fresard')],
            keywords: [kw({ keyword: 'Maderas del Sur de Chile', targetUrl: 'https://maderasfresard.com/', volume: 20 })],
         }));
         expect(out[0].status).toBe('pass');
         expect((out[0].evidence as any).candidatas).toHaveLength(1);
      });

      it('falla cuando el title apunta a la keyword chica teniendo una grande en seguimiento', () => {
         const out = targetTitle.run(input({
            domain: 'x.cl',
            pages: [page('https://x.cl/p', 'Arriendo de vestidos | Tienda')],
            keywords: [
               kw({ keyword: 'arriendo de vestidos', targetUrl: 'https://x.cl/p', volume: 30 }),
               kw({ keyword: 'venta de vestidos de fiesta', targetUrl: 'https://x.cl/p', volume: 900 }),
            ],
         }));
         expect(out[0].status).toBe('fail');
         expect(out[0].evidence).toMatchObject({ ratio: 0.03, mejorDisponible: { volumen: 900 } });
      });

      it('agrupa por página: varias keywords apuntando a la misma URL dan un solo veredicto', () => {
         const out = targetTitle.run(input({
            domain: 'mavae.cl',
            pages: [page('https://mavae.cl/regalos-corporativos-personalizados', 'Regalos Corporativos Personalizados | Mavae')],
            keywords: [
               kw({ keyword: 'regalos corporativos personalizados', targetUrl: 'https://mavae.cl/regalos-corporativos-personalizados', volume: 260 }),
               kw({ keyword: 'regalos corporativos', targetUrl: 'https://mavae.cl/regalos-corporativos-personalizados', volume: 5400 }),
            ],
         }));
         expect(out).toHaveLength(1);
         // el title contiene la de 5.400 dentro de la de 260, así que apunta a la mejor
         expect(out[0].status).toBe('pass');
         expect(out[0].evidence).toMatchObject({ enElTitle: { volumen: 5400 } });
      });

      it('falla cuando ninguna keyword objetivo aparece en el title', () => {
         const out = targetTitle.run(input({
            pages: [page('https://ammo.cl/accesorios/', 'Inicio | Tienda')],
            keywords: [kw({ keyword: 'Accesorios de fiesta en Temuco', targetUrl: 'https://ammo.cl/accesorios/', volume: 100 })],
         }));
         expect(out[0].status).toBe('fail');
         expect(out[0].evidence).toMatchObject({ motivo: expect.stringContaining('Ninguna keyword') });
      });

      it('no puntúa una página que no se pudo leer: un fallo de red nunca es un cero', () => {
         const out = targetTitle.run(input({
            pages: [page('https://ammo.cl/accesorios/', '', { fetchedOk: false, statusCode: 406 })],
            keywords: [kw({ keyword: 'accesorios temuco', targetUrl: 'https://ammo.cl/accesorios/', volume: 100 })],
         }));
         expect(out[0].status).toBe('na');
      });

      it('el umbral de valor es el 20% del mejor volumen disponible', () => {
         expect(MIN_VALUE_RATIO).toBe(0.2);
         const out = targetTitle.run(input({
            pages: [page('https://x.cl/p', 'Página de keyword chica')],
            keywords: [
               kw({ keyword: 'keyword chica', targetUrl: 'https://x.cl/p', volume: 25 }),
               kw({ keyword: 'keyword grande', targetUrl: 'https://x.cl/p', volume: 100 }),
            ],
         }));
         // 25/100 = 0,25 → por encima del 0,20, pasa
         expect(out[0].status).toBe('pass');
      });
   });

   describe('arq.cannibalisation', () => {
      it('detecta dos URLs propias compitiendo en el mismo top 20', () => {
         const out = cannibalisation.run(input({
            domain: 'ammo.cl',
            keywords: [kw({
               keyword: 'vestidos de fiesta temuco',
               serpTop: [
                  { position: 1, url: 'https://competidor.cl/', title: 'Otro' },
                  { position: 2, url: 'https://ammo.cl/', title: 'Ammo' },
                  { position: 9, url: 'https://ammo.cl/vestidos-de-fiesta/', title: 'Ammo vestidos' },
               ],
            })],
         }));
         expect(out[0].status).toBe('fail');
         expect((out[0].evidence as any).propiasEnTop20).toHaveLength(2);
      });

      it('pasa con una sola URL propia en la SERP', () => {
         const out = cannibalisation.run(input({
            domain: 'ammo.cl',
            keywords: [kw({ serpTop: [{ position: 2, url: 'https://ammo.cl/', title: 'Ammo' }] })],
         }));
         expect(out[0].status).toBe('pass');
      });

      it('no puntúa si no hay SERP guardada de esa búsqueda', () => {
         expect(cannibalisation.run(input({ keywords: [kw({ keyword: 'x' })] }))[0].status).toBe('na');
      });
   });
});
