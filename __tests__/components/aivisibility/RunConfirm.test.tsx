import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import toast from 'react-hot-toast';
import { RunConfirm } from '../../../components/aivisibility/RunNowButton';

jest.mock('react-hot-toast', () => jest.fn());

const wrap = (ui: React.ReactElement) => (
   <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);
const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe('RunConfirm', () => {
   afterEach(() => { jest.restoreAllMocks(); (toast as unknown as jest.Mock).mockClear(); });

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

   it('cierra el modal apenas el servidor confirma que la corrida empezó (pending)', async () => {
      jest.spyOn(global, 'fetch').mockImplementation(() => json({ runId: 1, status: 'pending', estimate: 0.12 }));
      const close = jest.fn();
      render(wrap(<RunConfirm domain='ammo.cl' scope={{ scope: 'domain', domain: 'ammo.cl' }} closeModal={close} />));
      await screen.findByText(/Esto cuesta/);
      fireEvent.click(screen.getByText('Actualizar'));
      await waitFor(() => expect(close).toHaveBeenCalled());
      expect(toast).toHaveBeenCalledWith('Actualización iniciada. Los resultados aparecerán en unos minutos.', { icon: '✔️' });
      expect(screen.queryByText(/No cierres esta ventana/)).toBeNull();
   });

   it('409: avisa que ya hay una actualización en curso y no cierra', async () => {
      jest.spyOn(global, 'fetch').mockImplementation((_url, init) => ((init as RequestInit)?.method === 'POST'
         ? Promise.resolve({
            ok: false, status: 409, json: () => Promise.resolve({ error: 'Ya hay una actualización en curso para este alcance' }),
         } as Response)
         : json({ estimate: 0.12 })));
      const close = jest.fn();
      render(wrap(<RunConfirm domain='ammo.cl' scope={{ scope: 'domain', domain: 'ammo.cl' }} closeModal={close} />));
      await screen.findByText(/Esto cuesta/);
      fireEvent.click(screen.getByText('Actualizar'));
      await waitFor(() => expect(toast).toHaveBeenCalledWith('Ya hay una actualización en curso para este alcance', { icon: '⚠️' }));
      expect(close).not.toHaveBeenCalled();
   });

   it('costo 0: explica que no hay nada que consultar y no deja confirmar', async () => {
      const calls: string[] = [];
      jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
         calls.push((init as RequestInit)?.method || 'GET');
         return json({ estimate: 0 });
      });
      render(wrap(<RunConfirm domain='maderasfresard.com' scope={{ scope: 'domain', domain: 'maderasfresard.com' }} closeModal={jest.fn()} />));
      await screen.findByText(/No hay nada que consultar/);
      expect(screen.queryByText(/Esto cuesta/)).toBeNull();
      expect(screen.getByText('Actualizar')).toBeDisabled();
      expect(calls).toEqual(['GET']);
   });
});
