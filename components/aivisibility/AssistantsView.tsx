import React, { useState } from 'react';
import { useAuthUser } from '../../services/auth';
import { AiRunScope, useFetchAiVisibility } from '../../services/aiVisibility';
import SummaryCards from './SummaryCards';
import EngineCards from './EngineCards';
import PromptsTable from './PromptsTable';
import PromptDetail from './PromptDetail';
import CompetitorsTable from './CompetitorsTable';
import SourcesGrid from './SourcesGrid';
import EvolutionChart from './EvolutionChart';
import RunNowButton, { RunConfirm } from './RunNowButton';

const fmtDate = (iso: string, withWeekday = false) => {
   const d = new Date(iso);
   const date = d.toLocaleDateString('es-CL', { weekday: withWeekday ? 'short' : undefined, day: '2-digit', month: 'short' }).replace(/\./g, '');
   return `${date} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};
const usd = (n: number) => `US$${n.toFixed(2)}`.replace('.', ',');

const AssistantsView = ({ domain }: { domain: string }) => {
   const auth = useAuthUser();
   const { data, isLoading, isError } = useFetchAiVisibility(domain);
   const [activeTag, setActiveTag] = useState('');
   const [promptRun, setPromptRun] = useState<AiRunScope | null>(null);
   const canRun = auth.isSuperadmin;

   if (isLoading) { return <div className="p-5 text-sm text-gray-500">Cargando visibilidad en IAs…</div>; }
   if (isError || !data) { return <div className="p-5 text-sm text-red-700">No se pudo cargar la visibilidad en IAs.</div>; }

   return (
      <div className="bg-white border border-gray-300 rounded p-5">
         {data.lastRun?.status === 'skipped_budget' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded px-3 py-2 mb-4">
               Se alcanzó el tope mensual ({usd(data.monthSpend)} de {usd(data.budget)}). La corrida se pausó.
            </div>
         )}
         <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div className="text-xs text-gray-500">
               Última medición: <b>{data.lastRun ? fmtDate(data.lastRun.started_at) : 'sin mediciones'}</b>
               {' '}· Próxima: <b>{fmtDate(data.nextRun, true)}</b> · Semanal · 3 repeticiones
            </div>
            <RunNowButton domain={domain} canRun={canRun} />
         </div>

         <SummaryCards data={data} />
         <EngineCards byEngine={data.byEngine} />

         {data.prompts.length === 0
            ? <p className="text-sm text-gray-500 py-6">Aún no hay prompts para medir en este dominio.</p>
            : <PromptsTable
               prompts={data.prompts}
               activeTag={activeTag}
               onTagChange={setActiveTag}
               canRun={canRun}
               onRun={(id) => setPromptRun({ scope: 'prompt', id })}
               renderDetail={(p) => <PromptDetail domain={domain} prompt={p} />}
               />}

         <h2 className="mt-8 mb-2 font-semibold">
            Competencia <span className="text-xs font-normal text-gray-400">— veces nombrados en las {data.totals.answers} respuestas</span>
         </h2>
         <CompetitorsTable data={data} domain={domain} />

         <h2 className="mt-8 mb-2 font-semibold">
            Fuentes que usan las IAs <span className="text-xs font-normal text-gray-400">— dónde conviene estar</span>
         </h2>
         <SourcesGrid data={data} domain={domain} />

         <h2 className="mt-8 mb-2 font-semibold">Evolución semanal</h2>
         <EvolutionChart evolution={data.evolution} />

         {promptRun && <RunConfirm domain={domain} scope={promptRun} closeModal={() => setPromptRun(null)} />}
      </div>
   );
};

export default AssistantsView;
