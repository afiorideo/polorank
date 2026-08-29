import { render, screen } from '@testing-library/react';
import PositionChange from '../../components/keywords/PositionChange';

describe('PositionChange Component', () => {
   it('muestra la posición anterior entre paréntesis cuando existe', async () => {
      render(<PositionChange change={{ change: -70, position: 31 }} withPosition />);
      expect(screen.getByText('(31)')).toBeInTheDocument();
      expect(screen.getByText('−70')).toBeInTheDocument();
   });

   it('omite el paréntesis cuando antes estaba fuera del top (posición 0)', async () => {
      const { container } = render(<PositionChange change={{ change: 53, position: 0 }} withPosition />);
      expect(screen.getByText('+53')).toBeInTheDocument();
      expect(container.querySelector('small')).toBeNull();
      expect(container.textContent).toBe('+53');
      expect(screen.getByTitle('Entonces: posición fuera')).toBeInTheDocument();
   });

   it('muestra solo un guion cuando no hay dato para ese período', async () => {
      const { container } = render(<PositionChange change={{ change: null, position: null }} withPosition />);
      expect(container.textContent).toBe('—');
      expect(screen.getByTitle('Sin datos para ese período')).toBeInTheDocument();
   });

   it('muestra "=" cuando estaba fuera y sigue fuera', async () => {
      const { container } = render(<PositionChange change={{ change: 0, position: 0 }} withPosition />);
      expect(container.textContent).toBe('=');
   });
});
