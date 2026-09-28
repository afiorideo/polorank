import { render, screen } from '@testing-library/react';
import AiCitedBadge from '../../components/aitracking/AiCitedBadge';

describe('AiCitedBadge', () => {
   it('muestra Sí cuando te citan', () => {
      const { container } = render(<AiCitedBadge cited={1} />);
      expect(container.textContent).toBe('✓ Sí');
      expect(screen.getByTitle('Google te cita como fuente de su resumen')).toBeInTheDocument();
   });

   it('muestra No cuando hubo resumen y no te citó', () => {
      const { container } = render(<AiCitedBadge cited={0} />);
      expect(container.textContent).toBe('✗ No');
   });

   it('REGLA: sin resumen muestra N/A en gris, no una cruz roja', () => {
      const { container } = render(<AiCitedBadge cited={-1} />);
      expect(container.textContent).toBe('— N/A');
      const el = screen.getByTitle(/no respondió con IA/);
      expect(el.className).toContain('slate');
      expect(el.className).not.toContain('rose');
   });

   it('el título del N/A explica que no es "no te citan"', () => {
      render(<AiCitedBadge cited={-1} />);
      expect(screen.getByTitle(/No es que no te citen/)).toBeInTheDocument();
   });

   it('en modo mención cambia la ayuda, no el estado dibujado', () => {
      const { container, rerender } = render(<AiCitedBadge cited={1} kind='mention' />);
      expect(container.textContent).toBe('✓ Sí');
      expect(screen.getByTitle('El texto del resumen escribe tu marca')).toBeInTheDocument();
      rerender(<AiCitedBadge cited={0} kind='mention' />);
      expect(screen.getByTitle(/no escribe tu marca/)).toBeInTheDocument();
   });

   /**
    * -2 es "Google respondió con IA y no leímos el contenido". Dibujarlo como el N/A normal hacía que la
    * pantalla afirmara algo falso ("Google no respondió con IA para esta búsqueda").
    */
   it('REGLA: el resumen diferido se distingue del N/A y no dice que Google no respondió', () => {
      const { container } = render(<AiCitedBadge cited={-2} />);
      expect(container.textContent).toBe('— sin leer');
      const badge = screen.getByTitle(/entrega el contenido en una segunda consulta/);
      expect(badge).toBeInTheDocument();
      expect(badge.getAttribute('title')).not.toContain('no respondió con IA');
   });
});
