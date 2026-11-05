import React, { useState } from 'react';
import Modal from '../common/Modal';
import { AiFullAnswer, AiVisibilityData, useAiConfig, useAiPromptAnswers } from '../../services/aiVisibility';
import type { Engine } from '../../utils/aiVisibility/budget';
import { ENGINE_ORDER, ENGINE_LABEL } from './engines';
import { cellLabel } from './PromptsTable';

type PromptRow = AiVisibilityData['prompts'][number];

const parse = <T, >(raw: string, fallback: T): T => {
   try { return (JSON.parse(raw) ?? fallback) as T; } catch { return fallback; }
};

/** Primeros 280 caracteres alrededor de la primera mención de la marca, o del inicio. */
export const excerpt = (text: string, variants: string[]): string => {
   const lower = text.toLowerCase();
   const hits = variants.map((v) => lower.indexOf(v.toLowerCase())).filter((i) => i >= 0);
   if (!hits.length) { return text.length > 280 ? `${text.slice(0, 280)}…` : text; }
   const at = Math.min(...hits);
   const start = Math.max(0, at - 80);
   const end = Math.min(text.length, start + 280);
   return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

const PromptDetail = ({ domain, prompt }: { domain: string, prompt: PromptRow }) => {
   const { data, isLoading, isError } = useAiPromptAnswers(domain, prompt.id);
   const { data: config } = useAiConfig(domain);
   const [fullEngine, setFullEngine] = useState<Engine | null>(null);
   const variants = config?.settings.brand_variants || [];

   if (isLoading) { return <div className="bg-gray-50 border-t px-4 py-4 text-xs text-gray-500">Cargando respuestas…</div>; }
   if (isError || !data) { return <div className="bg-gray-50 border-t px-4 py-4 text-xs text-red-700">No se pudieron cargar las respuestas.</div>; }

   const answersOf = (e: Engine): AiFullAnswer[] => data.answers.filter((a) => a.engine === e && a.status === 'ok');

   return (
      <div className="bg-gray-50 border-t px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
         {ENGINE_ORDER.map((e) => {
            const cell = prompt.cells[e];
            const rows = answersOf(e);
            if (!rows.length) { return null; }
            const shown = rows.find((r) => r.mentioned) || rows[0];
            const sources = parse<{ domain: string }[]>(shown.sources, []);
            const fanOut = Array.from(new Set(rows.flatMap((r) => parse<string[]>(r.fan_out, [])))).slice(0, 2);
            const ok = cell.mentioned > 0;
            return (
               <div key={e} className={`bg-surface border rounded p-3 ${ok ? '' : 'border-red-200'}`}>
                  <div className="flex justify-between mb-1">
                     <b>{ENGINE_LABEL[e]}</b>
                     <span className={ok ? 'text-green-600' : 'text-red-700'}>
                        {ok ? `Te nombra ${cellLabel(cell)}${cell.cited ? ' · te cita' : ''}` : `No te nombra (0/${cell.total})`}
                     </span>
                  </div>
                  <p className="text-gray-600 italic">&ldquo;{excerpt(shown.text || '', variants)}&rdquo;</p>
                  {fanOut.length > 0 && (
                     <div className="mt-2 text-gray-500"><b>Buscó por dentro:</b> {fanOut.map((f) => `«${f}»`).join(' · ')}</div>
                  )}
                  {sources.length > 0 && (
                     <div className="text-gray-500">
                        <b>Fuentes:</b> {sources.slice(0, 5).map((s) => s.domain).join(' · ')}
                        {sources.length > 5 ? ` · +${sources.length - 5}` : ''}
                     </div>
                  )}
                  <button className="text-blue-600 mt-1" onClick={() => setFullEngine(e)}>
                     Ver las {rows.length} respuestas completas →
                  </button>
               </div>
            );
         })}
         {fullEngine && (
            <Modal closeModal={() => setFullEngine(null)} title={`${ENGINE_LABEL[fullEngine]} · respuestas completas`} width="3/4" verticalCenter>
               <div className="max-h-[60vh] overflow-auto text-sm space-y-4">
                  {answersOf(fullEngine).map((a) => (
                     <div key={a.ID}>
                        <div className="text-xs text-gray-400 mb-1">Repetición {a.rep}</div>
                        <p className="whitespace-pre-wrap">{a.text}</p>
                     </div>
                  ))}
               </div>
            </Modal>
         )}
      </div>
   );
};

export default PromptDetail;
