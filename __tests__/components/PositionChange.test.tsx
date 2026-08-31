import { render, screen } from '@testing-library/react';
import PositionChange from '../../components/keywords/PositionChange';

describe('PositionChange Component', () => {
   it('muestra el número y la posición anterior cuando ambas puntas son reales', async () => {
      const { container } = render(<PositionChange change={{ change: -16, position: 31, state: 'ok' }} withPosition />);
      expect(container.textContent).toBe('−16(31)');
      expect(screen.getByTitle('Entonces: posición 31')).toBeInTheDocument();
   });

   it('cuando entró al rango revisado muestra solo la flecha, sin número inventado', async () => {
      const { container } = render(<PositionChange change={{ change: null, position: 0, state: 'entered' }} withPosition />);
      expect(container.textContent).toBe('▲');
      expect(container.textContent).not.toMatch(/\d/);
      expect(screen.getByTitle('Entró: entonces no aparecía entre los resultados revisados')).toBeInTheDocument();
   });

   it('cuando salió del rango muestra la flecha Y desde qué posición cayó: ese dato sí se midió', async () => {
      const { container } = render(<PositionChange change={{ change: null, position: 12, state: 'left' }} withPosition />);
      expect(container.textContent).toBe('▼(12)');
      expect(screen.getByTitle('Salió: entonces estaba en la posición 12')).toBeInTheDocument();
   });

   it('caso real de mavae: estaba en 21 hace 7 días y hoy no aparece', async () => {
      const { container } = render(<PositionChange change={{ change: null, position: 21, state: 'left' }} withPosition />);
      expect(container.textContent).toBe('▼(21)');
      // no inventa cuánto cayó: no hay número de cambio, solo el punto de partida
      expect(container.textContent).not.toMatch(/−|\+/);
   });

   it('muestra "=" cuando estaba fuera y sigue fuera', async () => {
      const { container } = render(<PositionChange change={{ change: 0, position: 0, state: 'out' }} withPosition />);
      expect(container.textContent).toBe('=');
      expect(screen.getByTitle('Sigue fuera de los resultados revisados')).toBeInTheDocument();
   });

   it('muestra un guion cuando no hay dato para ese período', async () => {
      const { container } = render(<PositionChange change={{ change: null, position: null, state: 'nodata' }} withPosition />);
      expect(container.textContent).toBe('—');
      expect(screen.getByTitle('Sin datos para ese período')).toBeInTheDocument();
   });
});
