import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { RunConfirm } from '../../../components/aivisibility/RunNowButton';

jest.mock('react-hot-toast', () => jest.fn());

const wrap = (ui: React.ReactElement) => (
   <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);
const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe('RunConfirm', () => {
   afterEach(() => { jest.restoreAllMocks(); });

   it('solo lanza el POST al confirmar y mantiene el modal abierto si se omitió por tope', async () => {
      const calls: string[] = [];
      jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
         calls.push((init as RequestInit)?.method || 'GET');
         return json({ runId: 1, status: 'skipped_budget', estimate: 0.12 });
      });
      const close = jest.fn();
      render(wrap(<RunConfirm domain='ammo.cl' scope={{ scope: 'domain', domain: 'ammo.cl' }} closeModal={close} />));
      await screen.findByText(/Esto cuesta ~US\$0,12\./);
      expect(calls).toEqual(['GET']);

      fireEvent.click(screen.getByText('Actualizar'));
      await screen.findByText('Se alcanzó el tope mensual de gasto. No se hizo ninguna consulta.');
      expect(calls).toEqual(['GET', 'POST']);
      expect(close).not.toHaveBeenCalled();
   });

   it('cierra el modal cuando la corrida termina', async () => {
      jest.spyOn(global, 'fetch').mockImplementation(() => json({ runId: 1, status: 'done', estimate: 0.12 }));
      const close = jest.fn();
      render(wrap(<RunConfirm domain='ammo.cl' scope={{ scope: 'domain', domain: 'ammo.cl' }} closeModal={close} />));
      await screen.findByText(/Esto cuesta/);
      fireEvent.click(screen.getByText('Actualizar'));
      await waitFor(() => expect(close).toHaveBeenCalled());
   });
});
