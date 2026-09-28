import { parseAiText, parseInline, domainOfUrl } from '../../utils/aiText';

// fragmento textual del resumen real de "pacote pucon chile"
const REAL = 'Um pacote de viagem para Pucón, no Chile, `custa em média a partir de R$ 5.795,00 por pessoa`'
   + ', e costuma incluir hospedagem.[[1]](https://desviantes.com.br/pacote/chile/pucon/conexao-natureza/)\n'
   + '\n### O que um pacote básico inclui\n\n'
   + '- **Hospedagem:** De 3 a 6 noites em hotéis com café da manhã.[[1]](https://thetravellab.com.br/pucon)';

describe('Resumen con IA · análisis del markdown', () => {
   it('separa el texto en bloques en vez de dejarlo en una sola línea', () => {
      const b = parseAiText(REAL);
      expect(b.map((x) => x.type)).toEqual(['paragraph', 'heading', 'bullet']);
      expect(b[1]).toEqual({ type: 'heading', text: 'O que um pacote básico inclui' });
   });

   it('REGLA: conserva los marcadores de cita, que son los que dicen DÓNDE cita a cada fuente', () => {
      const b = parseAiText(REAL);
      const citas = b.flatMap((x) => ('parts' in x ? x.parts : [])).filter((p) => p.type === 'cite');
      expect(citas).toHaveLength(2);
      expect(citas[1]).toEqual({ type: 'cite', url: 'https://thetravellab.com.br/pucon' });
   });

   it('reconoce negritas, resaltados y citas dentro de una línea, en orden', () => {
      const p = parseInline('Cuesta `mucho` y es **bueno**.[[1]](https://x.cl/a)');
      expect(p).toEqual([
         { type: 'text', text: 'Cuesta ' },
         { type: 'mark', text: 'mucho' },
         { type: 'text', text: ' y es ' },
         { type: 'bold', text: 'bueno' },
         { type: 'text', text: '.' },
         { type: 'cite', url: 'https://x.cl/a' },
      ]);
   });

   it('el número del marcador no identifica la fuente: se reinicia en cada bloque', () => {
      // dos [[1]] distintos apuntando a URLs diferentes — hay que usar la URL, no el número
      const citas = parseAiText(REAL).flatMap((x) => ('parts' in x ? x.parts : [])).filter((p) => p.type === 'cite');
      expect(citas[0]).not.toEqual(citas[1]);
   });

   it('no se rompe con texto vacío o ausente', () => {
      expect(parseAiText('')).toEqual([]);
      expect(parseAiText(null)).toEqual([]);
      expect(parseAiText(undefined)).toEqual([]);
   });

   it('domainOfUrl normaliza para poder cruzar la cita con la lista de fuentes', () => {
      expect(domainOfUrl('https://www.TheTravelLab.com.br/pucon')).toBe('thetravellab.com.br');
      expect(domainOfUrl('https://gochile.com.br/pacotes/x.htm')).toBe('gochile.com.br');
      expect(domainOfUrl('roto')).toBe('roto');
   });
});
