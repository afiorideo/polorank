import { findTargetPosition, normalizeUrl, ranksOtherPage, sameUrl, targetPath, toTargetUrl } from '../../utils/targetUrl';

describe('URL objetivo por keyword (PoloRank)', () => {
   it('normalizeUrl ignora protocolo, www, barra final, query y hash', () => {
      expect(normalizeUrl('https://www.Ammo.cl/Vestidos/?utm=x#top')).toBe('ammo.cl/vestidos');
      expect(normalizeUrl('http://ammo.cl/')).toBe('ammo.cl');
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl(null)).toBe('');
   });

   it('sameUrl compara páginas, no subrutas', () => {
      expect(sameUrl('https://ammo.cl/graduacion/', 'ammo.cl/graduacion')).toBe(true);
      expect(sameUrl('https://ammo.cl/graduacion/', 'https://ammo.cl/graduacion/rojos/')).toBe(false);
      expect(sameUrl('https://ammo.cl/', 'https://www.ammo.cl')).toBe(true);
      expect(sameUrl('', '')).toBe(false);
   });

   it('toTargetUrl acepta ruta o URL completa del mismo dominio', () => {
      expect(toTargetUrl('/vestidos-de-graduacion-en-temuco/', 'ammo.cl')).toBe('https://ammo.cl/vestidos-de-graduacion-en-temuco/');
      expect(toTargetUrl('https://www.ammo.cl/vestidos/?utm=1', 'ammo.cl')).toBe('https://ammo.cl/vestidos');
      expect(toTargetUrl('ammo.cl', 'ammo.cl')).toBe('https://ammo.cl');
      expect(toTargetUrl('https://blog.ammo.cl/post', 'ammo.cl')).toBe('https://blog.ammo.cl/post');
      expect(toTargetUrl('https://otrositio.cl/vestidos', 'ammo.cl')).toBeNull();
      expect(toTargetUrl('   ', 'ammo.cl')).toBeNull();
      expect(toTargetUrl(null, 'ammo.cl')).toBeNull();
   });

   it('targetPath muestra la ruta corta', () => {
      expect(targetPath('https://ammo.cl/vestidos-de-graduacion-en-temuco/', 'ammo.cl')).toBe('/vestidos-de-graduacion-en-temuco');
      expect(targetPath('https://ammo.cl/', 'ammo.cl')).toBe('/');
      expect(targetPath(null, 'ammo.cl')).toBe('');
   });

   it('findTargetPosition encuentra la landing en la SERP (y 0 si no está)', () => {
      const serp = [
         { position: 1, url: 'https://otro.cl/', title: 'a' },
         { position: 2, url: 'https://ammo.cl/', title: 'home' },
         { position: 3, url: '', title: '', skipped: true },
         { position: 14, url: 'https://www.ammo.cl/vestidos-de-graduacion-en-temuco/', title: 'landing' },
      ];
      expect(findTargetPosition('https://ammo.cl/vestidos-de-graduacion-en-temuco/', serp)).toBe(14);
      expect(findTargetPosition('https://ammo.cl/', serp)).toBe(2);
      expect(findTargetPosition('https://ammo.cl/no-esta/', serp)).toBe(0);
      expect(findTargetPosition(null, serp)).toBe(0);
      expect(findTargetPosition('https://ammo.cl/', null)).toBe(0);
   });

   it('ranksOtherPage avisa solo cuando hay objetivo y el dominio rankea con otra página', () => {
      expect(ranksOtherPage('https://ammo.cl/graduacion/', 'https://ammo.cl/', 2)).toBe(true);
      expect(ranksOtherPage('https://ammo.cl/graduacion/', 'https://ammo.cl/graduacion', 2)).toBe(false);
      expect(ranksOtherPage(null, 'https://ammo.cl/', 2)).toBe(false);
      expect(ranksOtherPage('https://ammo.cl/graduacion/', '', 0)).toBe(false);
   });
});
