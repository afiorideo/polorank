/**
 * PoloRank — running the catalogue over one site and turning it into the report the screen draws.
 *
 * Pure on purpose: it takes the gathered facts and returns the verdicts and scores. Crawling happens before,
 * persistence happens after. That keeps the whole scoring path unit-testable, and it is what guarantees the
 * audit can never interfere with the position scraper — there is nothing here that touches the database.
 */
import { CATALOG } from './catalog';
import { scoreBlock, globalScore, weightsFor } from './scoring';
import type { BlockScore, Gate, ScoredCheck } from './scoring';
import type { AuditBlock, AuditCheck, AuditInput, CheckVerdict } from './types';

/** The six donuts, in cascade-of-blocking order: what stops you ranking first, what refines it last. */
export const BLOCKS: Exclude<AuditBlock, 'strategy'>[] = ['indexing', 'technical', 'architecture', 'onpage', 'content', 'local'];

export const BLOCK_LABELS: Record<string, string> = {
   indexing: 'Indexación',
   technical: 'Técnico y rendimiento',
   architecture: 'Arquitectura y enlazado',
   onpage: 'On-Page',
   content: 'Contenido y cobertura',
   local: 'Local',
   strategy: 'Estrategia',
};

export type CheckOutcome = CheckVerdict & { checkId: string, block: string, weight: number, title: string, help: string };

export type AuditReport = {
   domain: string,
   blocks: BlockScore[],
   global: number,
   weights: Record<string, number>,
   outcomes: CheckOutcome[],
   gates: Gate[],
   /** Share of this domain's tracked searches that show a local pack. Drives the weight of the Local block. */
   localPackRate: number,
};

/** How often the map pack shows up in this domain's SERPs. Free: it comes from the daily snapshot. */
export const localPackRateOf = (input: AuditInput): number => {
   const withSerp = input.keywords.filter((k) => Array.isArray(k.serpFeatures));
   if (withSerp.length === 0) { return 0; }
   return withSerp.filter((k) => k.serpFeatures.includes('local_pack')).length / withSerp.length;
};

/**
 * Blocking problems, which CAP the score instead of subtracting from it. A site Google cannot index is not
 * "85% optimised" because its titles are tidy.
 */
export const gatesFor = (input: AuditInput): Gate[] => {
   const gates: Gate[] = [];
   const home = input.home || input.pages.find((p) => p.clickDepth === 0);
   if (home?.fetchedOk && !home.indexable) {
      gates.push({ name: 'La home está en noindex', blockCap: 20, globalCap: 30 });
   }
   if (home && !home.url.startsWith('https://')) {
      gates.push({ name: 'El sitio no usa HTTPS', blockCap: 60, globalCap: 60 });
   }
   return gates;
};

const runCheck = (check: AuditCheck, input: AuditInput): CheckOutcome[] => {
   try {
      return check.run(input).map((v) => ({
         ...v, checkId: check.id, block: check.block, weight: check.weight, title: check.title, help: check.help,
      }));
   } catch (error) {
      // A broken check must not take the whole audit down; it reports itself as not measurable.
      console.log('[ERROR] El check falló y se marca no medible:', check.id, error instanceof Error ? error.message : error);
      return [{
         status: 'na',
         score: 0,
         evidence: { motivo: 'El check falló al ejecutarse' },
         checkId: check.id,
         block: check.block,
         weight: check.weight,
         title: check.title,
         help: check.help,
      }];
   }
};

export const runAudit = (input: AuditInput, catalog: AuditCheck[] = CATALOG): AuditReport => {
   const outcomes = catalog.flatMap((check) => runCheck(check, input));
   const gates = gatesFor(input);
   const localPackRate = localPackRateOf(input);
   const weights = weightsFor(input.profile, localPackRate);

   const blocks = BLOCKS.map((block) => {
      const scored: ScoredCheck[] = outcomes
         .filter((o) => o.block === block)
         .map((o) => ({ status: o.status, score: o.score, weight: o.weight }));
      // gates only cap the block they are about; indexing gates cap indexing
      const blockGates = block === 'indexing' ? gates : [];
      return scoreBlock(block, scored, blockGates);
   });

   return { domain: input.domain, blocks, global: globalScore(blocks, weights, gates), weights, outcomes, gates, localPackRate };
};

export default runAudit;
