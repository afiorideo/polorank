import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import AiConfigModal from '../../../components/aivisibility/AiConfigModal';

jest.mock('react-hot-toast', () => jest.fn());

const wrap = (ui: React.ReactElement) => (
   <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
);
const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const prompts = Array.from({ length: 5 }, (_, i) => ({ ID: i + 1, domain: 'ammo.cl', prompt: `Prompt ${i + 1}`, tags: '[]', active: true }));
const settings = (enabled: boolean) => ({
   enabled, brand_variants: ['ammo'], brand_urls: ['ammo.cl'], competitors: [], location_code: 2152, language_code: 'es', country_iso: 'CL',
});

const mockApi = (enabled: boolean, puts: any[] = []) => jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
   if (String(url).includes('/prompts')) { return json({ prompts, max: 5 }); }
   if ((init as RequestInit)?.method === 'PUT') { puts.push(JSON.parse(String((init as RequestInit).body))); }
   return json({ settings: settings(enabled) });
});

describe('AiConfigModal', () => {
   afterEach(() => { jest.restoreAllMocks(); });

   it('deshabilita "+ Agregar prompt" con el máximo de prompts activos', async () => {
      mockApi(true);
      render(wrap(<AiConfigModal domain='ammo.cl' canEditPrompts canEditSettings maxPrompts={5} closeModal={jest.fn()} />));
      await screen.findByText('Máximo 5 prompts');
      expect((screen.getByText('+ Agregar prompt') as HTMLButtonElement).disabled).toBe(true);
   });

   it.each([true, false])('al guardar envía enabled=%s de forma explícita', async (enabled) => {
      const puts: any[] = [];
      mockApi(enabled, puts);
      render(wrap(<AiConfigModal domain='ammo.cl' canEditPrompts canEditSettings detectedCompetitors={['Rival']} closeModal={jest.fn()} />));
      const checkbox = await screen.findByLabelText('Medir este dominio') as HTMLInputElement;
      await waitFor(() => expect((screen.getByLabelText('Variantes de la marca') as HTMLTextAreaElement).value).toBe('ammo'));
      expect(checkbox.checked).toBe(enabled);
      fireEvent.click(screen.getByText('Rival + agregar'));
      fireEvent.click(screen.getByText('Guardar configuración'));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0].settings.enabled).toBe(enabled);
      expect(puts[0].settings.competitors).toEqual([{ name: 'Rival', variants: [] }]);
   });

   it('permite escribir varias variantes de un competidor, letra por letra', async () => {
      const puts: any[] = [];
      mockApi(true, puts);
      render(wrap(<AiConfigModal domain='ammo.cl' canEditPrompts canEditSettings detectedCompetitors={['Blanka']} closeModal={jest.fn()} />));
      await waitFor(() => expect((screen.getByLabelText('Variantes de la marca') as HTMLTextAreaElement).value).toBe('ammo'));
      fireEvent.click(screen.getByText('Blanka + agregar'));
      const input = screen.getByLabelText('Variantes del competidor 1') as HTMLInputElement;
      let typed = '';
      'Blanka, Blanka Atelier'.split('').forEach((ch) => {
         typed += ch;
         fireEvent.change(input, { target: { value: typed } });
      });
      expect(input.value).toBe('Blanka, Blanka Atelier');
      fireEvent.click(screen.getByText('Guardar configuración'));
      await waitFor(() => expect(puts).toHaveLength(1));
      expect(puts[0].settings.competitors).toEqual([{ name: 'Blanka', variants: ['Blanka', 'Blanka Atelier'] }]);
   });

   it('domain_admin: edita prompts pero no ve marca, competidores, país ni "Medir este dominio"', async () => {
      mockApi(true);
      render(wrap(<AiConfigModal domain='ammo.cl' canEditPrompts canEditSettings={false} closeModal={jest.fn()} />));
      await screen.findAllByTestId('ai-prompt-row');
      expect(screen.queryByLabelText('Medir este dominio')).toBeNull();
      expect(screen.queryByLabelText('Variantes de la marca')).toBeNull();
      expect(screen.queryByText('Competidores')).toBeNull();
      expect(screen.queryByLabelText('País')).toBeNull();
      expect(screen.queryByText('Guardar configuración')).toBeNull();
      expect(screen.getByText('Cerrar')).toBeTruthy();
      expect((screen.getAllByLabelText('Texto del prompt')[0] as HTMLTextAreaElement).readOnly).toBe(false);
   });

   it('sin permiso de prompts: los prompts quedan de solo lectura', async () => {
      mockApi(true);
      render(wrap(<AiConfigModal domain='ammo.cl' canEditPrompts={false} canEditSettings={false} closeModal={jest.fn()} />));
      await screen.findAllByTestId('ai-prompt-row');
      expect((screen.getAllByLabelText('Texto del prompt')[0] as HTMLTextAreaElement).readOnly).toBe(true);
      expect((screen.getByText('+ Agregar prompt') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getAllByText('Eliminar')[0] as HTMLButtonElement).disabled).toBe(true);
   });
});
