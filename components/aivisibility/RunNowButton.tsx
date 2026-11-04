import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { AiRunScope, skippedMessage, useAiRunEstimate, useRunAiNow } from '../../services/aiVisibility';

const usd = (n: number) => `US$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`.replace('.', ',');

/** Modal de confirmación con el costo estimado (sin window.confirm). */
type ConfirmProps = { domain: string, scope: AiRunScope, closeModal: () => void };

export const RunConfirm = ({ domain, scope: initialScope, closeModal }: ConfirmProps) => {
   const [scope] = useState(initialScope);
   const estimate = useAiRunEstimate();
   const run = useRunAiNow(domain);
   const { mutate } = estimate;
   useEffect(() => { mutate(scope); }, [mutate, scope]);

   // el servidor responde al instante ('pending'): se cierra y el aviso lo da el toast
   const confirm = () => run.mutate(scope, {
      onSuccess: (out) => { if (!skippedMessage(out.status)) { closeModal(); } },
   });
   const skipped = run.data ? skippedMessage(run.data.status) : null;
   return (
      <Modal closeModal={run.isLoading ? () => {} : closeModal} title="Actualizar ahora" verticalCenter>
         {estimate.isLoading && <p className="text-sm text-gray-500">Calculando costo…</p>}
         {estimate.isError && <p className="text-sm text-red-700">No se pudo calcular el costo.</p>}
         {estimate.data && <p className="text-sm">Esto cuesta ~{usd(estimate.data.estimate)}. ¿Actualizar ahora?</p>}
         {skipped && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-3">{skipped}</p>}
         <div className="flex justify-end gap-2 mt-4 text-sm">
            <button
            className="px-3 py-1.5 bg-white border rounded disabled:opacity-50"
            disabled={run.isLoading}
            onClick={closeModal}>
               Cancelar
            </button>
            <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!estimate.data || run.isLoading}
            onClick={confirm}>
               {run.isLoading ? 'Iniciando…' : 'Actualizar'}
            </button>
         </div>
      </Modal>
   );
};

/** Botón de la cabecera. Solo lo ve el superadmin (el servidor también lo exige). */
const RunNowButton = ({ domain, canRun }: { domain: string, canRun: boolean }) => {
   const [open, setOpen] = useState(false);
   if (!canRun) { return null; }
   return (
      <>
         <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm" onClick={() => setOpen(true)}>↻ Actualizar ahora</button>
         {open && <RunConfirm domain={domain} scope={{ scope: 'domain', domain }} closeModal={() => setOpen(false)} />}
      </>
   );
};

export default RunNowButton;
