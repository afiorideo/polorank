import React from 'react';
import type { GoogleIaMeasure } from '../../utils/aiVisibility/googleStatus';

const fmtDate = (iso: string) => {
   const d = new Date(iso);
   const date = d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
   return `${date} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

/** Línea de estado de la vista Google IA: cuándo se midió por última vez y qué tan confiable salió. */
const GoogleIaStatus = ({ measure, inProgress }: { measure: GoogleIaMeasure | null, inProgress: boolean }) => (
   <div className='text-xs text-gray-500 mb-3'>
      Última medición: <b>{measure ? fmtDate(measure.at) : 'sin mediciones'}</b>
      {measure && <> · {measure.keywords} palabras clave · {measure.untrusted} con página no confiable</>}
      {' '}· Semanal (lunes)
      {inProgress && <span className='ml-2 text-blue-600 font-medium'>Actualizando…</span>}
   </div>
);

export default GoogleIaStatus;
