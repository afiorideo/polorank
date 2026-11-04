import { render, screen } from '@testing-library/react';
import PromptsTable from '../../../components/aivisibility/PromptsTable';

const cell = (m: number, p: number) => ({ mentioned: m, total: 3, bestPosition: p, cited: m });
const prompts = [{
   id: 1,
prompt: '¿Dónde arriendo?',
tags: ['arriendo'],
   cells: { chatgpt: cell(3, 1), gemini: cell(3, 1), ai_mode: cell(2, 2), perplexity: cell(0, 0) },
   topBrands: [{ name: 'Armario de la Karo', count: 6 }],
deltaVsPrev: null,
}];

describe('PromptsTable', () => {
   it('muestra 3/3 · #1 y 0/3 en rojo', () => {
      render(<PromptsTable prompts={prompts} activeTag='' onRun={() => {}} />);
      expect(screen.getAllByText('3/3 · #1')).toHaveLength(2);
      expect(screen.getByText('0/3')).toHaveClass('text-red-700');
      expect(screen.getByText('2/3 · #2')).toHaveClass('text-yellow-800');
      expect(screen.getAllByText('3/3 · #1')[0]).toHaveClass('text-green-700');
      expect(screen.getByText(/Armario de la Karo \(6\)/)).toBeInTheDocument();
   });

   it('oculta los prompts que no tienen la etiqueta activa', () => {
      render(<PromptsTable prompts={prompts} activeTag='venta' onRun={() => {}} />);
      expect(screen.queryByText('¿Dónde arriendo?')).not.toBeInTheDocument();
   });
});
