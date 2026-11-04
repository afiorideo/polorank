import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import {
   AiPromptRow, useAiConfig, useAiPrompts, useDeleteAiPrompt, useSaveAiConfig, useSaveAiPrompt,
} from '../../services/aiVisibility';
import type { AiCompetitor } from '../../utils/aiVisibility/config';

const COUNTRIES = [
   { label: 'Chile', location_code: 2152, language_code: 'es', country_iso: 'CL' },
   { label: 'Brasil', location_code: 2076, language_code: 'pt', country_iso: 'BR' },
];
const DEFAULT_MAX_PROMPTS = 5;
const inputCls = 'w-full border rounded px-2 py-1 text-sm';

const parseTags = (raw: string): string[] => {
   try { const t = JSON.parse(raw || '[]'); return Array.isArray(t) ? t.filter((x) => typeof x === 'string') : []; } catch (e) { return []; }
};
const splitList = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);

/** Competidor en edición: las variantes se guardan como texto crudo y se separan al guardar. */
type CompetitorDraft = { name: string, variants: string };

type PromptRowProps = { domain: string, row?: AiPromptRow, onDone?: () => void };

/** Fila de un prompt existente (editar/eliminar) o de uno nuevo (sin `row`). */
const PromptEditor = ({ domain, row, onDone }: PromptRowProps) => {
   const [text, setText] = useState(row?.prompt || '');
   const [tags, setTags] = useState(row ? parseTags(row.tags).join(', ') : '');
   const save = useSaveAiPrompt(domain);
   const del = useDeleteAiPrompt(domain);
   const busy = save.isLoading || del.isLoading;
   const dirty = !row || text !== row.prompt || tags !== parseTags(row.tags).join(', ');
   const submit = () => save.mutate(
      { id: row?.ID, prompt: text.trim(), tags: splitList(tags, /,/) },
      { onSuccess: () => { if (!row) { setText(''); setTags(''); onDone?.(); } } },
   );
   return (
      <li className="border rounded p-2 mb-2" data-testid="ai-prompt-row">
         <textarea
         aria-label="Texto del prompt"
         className={inputCls}
         rows={2}
         maxLength={500}
         value={text}
         onChange={(e) => setText(e.target.value)} />
         <div className="flex items-center gap-2 mt-1">
            <input
            aria-label="Etiquetas del prompt"
            className={inputCls}
            placeholder="Etiquetas separadas por coma"
            value={tags}
            onChange={(e) => setTags(e.target.value)} />
            <button
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={busy || !text.trim() || !dirty}
            onClick={submit}>
               {row ? 'Guardar' : 'Crear'}
            </button>
            {row
               ? (
                  <button
                  className="px-2 py-1 text-xs bg-white border rounded text-red-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => del.mutate(row.ID)}>
                     Eliminar
                  </button>
               )
               : <button className="px-2 py-1 text-xs bg-white border rounded" disabled={busy} onClick={onDone}>Cancelar</button>}
         </div>
      </li>
   );
};

type Props = { domain: string, maxPrompts?: number, detectedCompetitors?: string[], closeModal: () => void };

const AiConfigModal = ({ domain, maxPrompts, detectedCompetitors = [], closeModal }: Props) => {
   const prompts = useAiPrompts(domain);
   const config = useAiConfig(domain);
   const saveConfig = useSaveAiConfig(domain);
   const [adding, setAdding] = useState(false);

   const [enabled, setEnabled] = useState(false);
   const [brands, setBrands] = useState('');
   const [urls, setUrls] = useState('');
   const [competitors, setCompetitors] = useState<CompetitorDraft[]>([]);
   const [iso, setIso] = useState('CL');
   const [gemini, setGemini] = useState('');
   const settings = config.data?.settings;
   useEffect(() => {
      if (!settings) { return; }
      setEnabled(settings.enabled === true);
      setBrands(settings.brand_variants.join('\n'));
      setUrls(settings.brand_urls.join('\n'));
      setCompetitors(settings.competitors.map((c) => ({ name: c.name, variants: c.variants.join(', ') })));
      setIso(COUNTRIES.some((c) => c.country_iso === settings.country_iso) ? settings.country_iso : 'CL');
      setGemini(settings.gemini_location_code ? String(settings.gemini_location_code) : '');
   }, [settings]);

   const rows = prompts.data?.prompts || [];
   const max = maxPrompts ?? prompts.data?.max ?? DEFAULT_MAX_PROMPTS;
   const full = rows.length >= max;
   const missing = detectedCompetitors.filter((n) => !competitors.some((c) => c.name.toLowerCase() === n.toLowerCase()));
   const brandList = splitList(brands, /\n/);

   const updateCompetitor = (i: number, patch: Partial<CompetitorDraft>) => setCompetitors(
      (list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)),
   );

   const submit = () => {
      const country = COUNTRIES.find((c) => c.country_iso === iso) || COUNTRIES[0];
      const geminiCode = parseInt(gemini, 10);
      saveConfig.mutate({
         enabled,
         brand_variants: brandList,
         brand_urls: splitList(urls, /\n/),
         competitors: competitors.filter((c) => c.name.trim()).map((c): AiCompetitor => ({ name: c.name, variants: splitList(c.variants, /,/) })),
         location_code: country.location_code,
         language_code: country.language_code,
         country_iso: country.country_iso,
         gemini_location_code: geminiCode > 0 ? geminiCode : undefined,
      }, { onSuccess: closeModal });
   };

   return (
      <Modal closeModal={closeModal} title="Prompts y competidores" width="2/3">
         <div className="max-h-[70vh] overflow-y-auto pr-1 text-sm">
            {config.isLoading && <p className="text-gray-500">Cargando configuración…</p>}
            {config.isError && <p className="text-red-700">No se pudo cargar la configuración.</p>}

            <label className="flex items-center gap-2 mb-4 font-medium">
               <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
               Medir este dominio
            </label>

            <h4 className="font-semibold mb-1">
               Prompts <span className="font-normal text-gray-400">({rows.length}/{max})</span>
            </h4>
            {prompts.isError && <p className="text-red-700">No se pudieron cargar los prompts.</p>}
            <ul>
               {rows.map((r) => <PromptEditor key={`${r.ID}-${r.prompt}-${r.tags}`} domain={domain} row={r} />)}
               {adding && !full && <PromptEditor domain={domain} onDone={() => setAdding(false)} />}
            </ul>
            <button
            className="px-2 py-1 text-xs bg-white border rounded disabled:opacity-50 mb-1"
            disabled={full || adding}
            onClick={() => setAdding(true)}>
               + Agregar prompt
            </button>
            {full && <span className="ml-2 text-xs text-amber-800">Máximo {max} prompts</span>}

            <h4 className="font-semibold mt-4 mb-1">
               Variantes de la marca <span className="font-normal text-gray-400">(una por línea)</span>
            </h4>
            <textarea
            aria-label="Variantes de la marca"
            className={inputCls}
            rows={3}
            value={brands}
            onChange={(e) => setBrands(e.target.value)} />
            {brandList.length === 0 && <p className="text-xs text-red-700">Agrega al menos una variante de la marca.</p>}

            <h4 className="font-semibold mt-3 mb-1">URLs propias <span className="font-normal text-gray-400">(una por línea)</span></h4>
            <textarea aria-label="URLs propias" className={inputCls} rows={3} value={urls} onChange={(e) => setUrls(e.target.value)} />

            <h4 className="font-semibold mt-4 mb-1">Competidores</h4>
            {competitors.map((c, i) => (
               <div className="flex gap-2 mb-1" key={i}>
                  <input
                  aria-label={`Competidor ${i + 1}`}
                  className={inputCls}
                  placeholder="Nombre"
                  value={c.name}
                  onChange={(e) => updateCompetitor(i, { name: e.target.value })} />
                  <input
                  aria-label={`Variantes del competidor ${i + 1}`}
                  className={inputCls}
                  placeholder="Variantes separadas por coma"
                  value={c.variants}
                  onChange={(e) => updateCompetitor(i, { variants: e.target.value })} />
                  <button
                  className="px-2 text-xs bg-white border rounded"
                  onClick={() => setCompetitors((l) => l.filter((_, j) => j !== i))}>
                     Quitar
                  </button>
               </div>
            ))}
            <button className="px-2 py-1 text-xs bg-white border rounded" onClick={() => setCompetitors((l) => [...l, { name: '', variants: '' }])}>
               + Agregar competidor
            </button>
            {missing.length > 0 && (
               <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Detectados en las respuestas de las IAs:</p>
                  <div className="flex flex-wrap gap-1">
                     {missing.map((n) => (
                        <button
                        key={n}
                        className="px-2 py-0.5 text-xs bg-gray-100 border rounded-full"
                        onClick={() => setCompetitors((l) => [...l, { name: n, variants: '' }])}>
                           {n} + agregar
                        </button>
                     ))}
                  </div>
               </div>
            )}

            <h4 className="font-semibold mt-4 mb-1">País del dominio</h4>
            <select aria-label="País" className={inputCls} value={iso} onChange={(e) => setIso(e.target.value)}>
               {COUNTRIES.map((c) => <option key={c.country_iso} value={c.country_iso}>{c.label}</option>)}
            </select>
            <h4 className="font-semibold mt-3 mb-1">
               Región de Gemini <span className="font-normal text-gray-400">(opcional, código numérico; Araucanía = 20153)</span>
            </h4>
            <input
            aria-label="Región de Gemini"
            className={inputCls}
            inputMode="numeric"
            value={gemini}
            onChange={(e) => setGemini(e.target.value.replace(/\D/g, ''))} />
         </div>
         <div className="flex justify-end gap-2 mt-4 text-sm">
            <button className="px-3 py-1.5 bg-white border rounded" onClick={closeModal}>Cancelar</button>
            <button
            className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!settings || saveConfig.isLoading || brandList.length === 0}
            onClick={submit}>
               {saveConfig.isLoading ? 'Guardando…' : 'Guardar configuración'}
            </button>
         </div>
      </Modal>
   );
};

export default AiConfigModal;
