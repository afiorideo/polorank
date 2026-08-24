import { useQuery } from 'react-query';
import type { UsageSummary } from '../utils/usageSummary';

export type UsageApiResponse = { summary?: UsageSummary, balance?: { usd: number | null, error?: string }, error?: string | null };

export const usageUrl = (from: string, to: string, extra = '') => `${window.location.origin}/api/usage?from=${from}&to=${to}${extra}`;

export async function fetchUsage(from: string, to: string, withBalance: boolean): Promise<UsageApiResponse> {
   const res = await fetch(usageUrl(from, to, withBalance ? '&balance=1' : ''), { method: 'GET' });
   if (!res.ok) {
      let message = 'No se pudo cargar el consumo';
      try { const data = await res.json(); message = data?.error || message; } catch (e) { /* keep default */ }
      throw new Error(message);
   }
   return res.json();
}

/** Consumption summary for a period (superadmin). The DataForSEO balance is requested only when asked (one free API call). */
export function useFetchUsage(from: string, to: string, withBalance: boolean, enabled: boolean) {
   return useQuery(['usage', from, to, withBalance], () => fetchUsage(from, to, withBalance), { enabled, staleTime: 60 * 1000 });
}
