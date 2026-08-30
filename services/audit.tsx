import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';

export type AuditBlockSummary = {
   block: string,
   compliance: number,
   coverage: number,
   weight: number,
   cappedBy: string,
   checksTotal: number,
   checksMeasured: number,
};

export type AuditRunSummary = {
   runId: number,
   domain: string,
   startedAt: string,
   finishedAt: string | null,
   status: string,
   pagesCrawled: number,
   durationMs: number,
   blocks: AuditBlockSummary[],
};

export type AuditCheckRow = {
   checkId: string,
   block: string,
   url: string,
   status: string,
   score: number,
   weight: number,
   evidence: Record<string, unknown>,
   reviewedAt: string | null,
   reviewNote: string,
};

export type AuditCatalogEntry = { id: string, title: string, help: string, block: string, kind: string };

/** Every verdict of a domain's latest audit, with its evidence. */
export function useFetchAuditDetail(domain: string | undefined) {
   return useQuery(['auditDetail', domain], async () => {
      const res = await fetch(`${window.location.origin}/api/audit/detail?domain=${encodeURIComponent(domain || '')}`);
      if (res.status >= 400) { throw new Error('No se pudo cargar el detalle'); }
      return res.json() as Promise<{ run: AuditRunSummary | null, checks: AuditCheckRow[], catalog: AuditCatalogEntry[] }>;
   }, { enabled: !!domain });
}

/** Latest audit of every domain. */
export function useFetchAudits() {
   return useQuery('audits', async () => {
      const res = await fetch(`${window.location.origin}/api/audit`, { method: 'GET' });
      if (res.status >= 400) { throw new Error('No se pudieron cargar las auditorías'); }
      return res.json() as Promise<{ runs: Record<string, AuditRunSummary> }>;
   });
}

/** Launch an audit of one domain. It crawls a client's site, so it is deliberately manual. */
export function useRunAudit(onDone?: () => void) {
   const client = useQueryClient();
   return useMutation(async (domain: string) => {
      const res = await fetch(`${window.location.origin}/api/audit`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (res.status >= 400) { throw new Error(data?.error || 'La auditoría falló'); }
      return data;
   }, {
      onSuccess: () => {
         toast('Auditoría completada', { icon: '✔️' });
         client.invalidateQueries('audits');
         client.invalidateQueries('auditDetail');
         if (onDone) { onDone(); }
      },
      onError: (error: Error) => {
         toast(error.message, { icon: '⚠️' });
      },
   });
}
