import { render, screen } from '@testing-library/react';
import GoogleIaStatus from '../../../components/aitracking/GoogleIaStatus';

describe('GoogleIaStatus', () => {
   it('muestra la última medición con palabras clave y páginas no confiables', () => {
      render(<GoogleIaStatus measure={{ at: '2026-11-06T00:44:56Z', keywords: 7, untrusted: 4 }} inProgress={false} />);
      expect(screen.getByText(/Última medición:/)).toBeInTheDocument();
      expect(screen.getByText(/7 palabras clave · 4 con página no confiable/)).toBeInTheDocument();
   });
   it('sin mediciones y en curso', () => {
      render(<GoogleIaStatus measure={null} inProgress />);
      expect(screen.getByText(/sin mediciones/)).toBeInTheDocument();
      expect(screen.getByText(/Actualizando…/)).toBeInTheDocument();
   });
});
