/**
 * PoloRank — turning check verdicts into the two numbers of each donut.
 *
 * The rules, and why each exists:
 * - COMPLIANCE is the weighted average of what could be measured. `na` and `pending_review` leave the
 *   denominator entirely: something we could not measure is not a failure.
 * - COVERAGE is how much of the block was actually assessed, counting the unmeasured ones in the denominator.
 *   Without this second number a block reading 100% is indistinguishable from a block that checked half of
 *   itself and passed. That is the difference between this and a checklist.
 * - GATES CAP, they do not subtract. A page Google cannot index cannot be "85% optimised" no matter how tidy
 *   its titles are, so a blocking problem puts a ceiling on the score instead of shaving points off it.
 * - The weight of LOCAL is corrected by evidence: if the map pack never shows up in this domain's SERPs, the
 *   block matters less, and the freed weight goes to the blocks that do decide the outcome.
 */
import type { AuditBlock, BusinessProfile, CheckVerdict } from './types';

export type BlockScore = {
   block: AuditBlock,
   /** 0-100: weighted average over the checks that could be measured. */
   compliance: number,
   /** 0-100: share of the block that was actually assessed. */
   coverage: number,
   checksTotal: number,
   checksMeasured: number,
   /** Name of the gate that capped the block, when one did. */
   cappedBy: string,
};

export type ScoredCheck = { status: CheckVerdict['status'], score: number, weight: number };

/** Declared weight of every block, by business profile. `strategy` never scores. */
export const PROFILE_WEIGHTS: Record<BusinessProfile, Record<Exclude<AuditBlock, 'strategy'>, number>> = {
   local: { indexing: 15, technical: 10, architecture: 10, onpage: 20, content: 12, local: 25 },
   local_national: { indexing: 15, technical: 10, architecture: 12, onpage: 20, content: 18, local: 15 },
   ecommerce: { indexing: 15, technical: 15, architecture: 15, onpage: 20, content: 20, local: 5 },
   services: { indexing: 15, technical: 10, architecture: 12, onpage: 20, content: 25, local: 5 },
};

/** A gate that caps a block and, optionally, the global score. */
export type Gate = { name: string, blockCap: number, globalCap?: number };

/** Verdicts that leave the compliance denominator: they were not measured, so they cannot fail. */
const NOT_MEASURED: CheckVerdict['status'][] = ['na', 'pending_review'];

const round = (n: number): number => Math.round(n * 10) / 10;

/** Compliance and coverage for one block. */
export const scoreBlock = (block: AuditBlock, checks: ScoredCheck[], gates: Gate[] = []): BlockScore => {
   const measured = checks.filter((c) => !NOT_MEASURED.includes(c.status));
   const weightSum = measured.reduce((a, c) => a + c.weight, 0);
   const scoreSum = measured.reduce((a, c) => a + c.weight * c.score, 0);
   let compliance = weightSum > 0 ? round((scoreSum / weightSum) * 100) : 0;
   const coverage = checks.length > 0 ? round((measured.length / checks.length) * 100) : 0;

   let cappedBy = '';
   for (const gate of gates) {
      if (compliance > gate.blockCap) { compliance = gate.blockCap; cappedBy = gate.name; }
   }
   // a block where nothing at all could be measured reports 0/0 rather than a fabricated 100
   if (measured.length === 0) { compliance = 0; }

   return { block, compliance, coverage, checksTotal: checks.length, checksMeasured: measured.length, cappedBy };
};

/**
 * Effective weight of the Local block given how often the map pack actually appears in this domain's SERPs.
 * A domain whose searches never show a map pack keeps half the declared weight; one where it always shows keeps
 * all of it and a bit more. The freed (or borrowed) weight is redistributed across the other blocks.
 */
export const localWeightFor = (declared: number, localPackRate: number): number => {
   const rate = Math.min(Math.max(localPackRate, 0), 1);
   return round(declared * (0.5 + rate));
};

/**
 * Block weights for a run: the profile table with Local corrected by evidence, normalised to 100 so the number
 * shown next to a donut reads as the percentage of the global score that block is responsible for.
 * The tables above are relative on purpose (they do not add up to 100); normalising happens here, once.
 */
export const weightsFor = (profile: BusinessProfile, localPackRate: number): Record<string, number> => {
   const declared = PROFILE_WEIGHTS[profile];
   const localEffective = localWeightFor(declared.local, localPackRate);
   const others = (Object.keys(declared) as (keyof typeof declared)[]).filter((k) => k !== 'local');
   const othersSum = others.reduce((a, k) => a + declared[k], 0);
   // whatever Local gave up (or took) is shared by the rest in proportion to their own weight
   const spare = declared.local - localEffective;
   const raw: Record<string, number> = { local: localEffective };
   others.forEach((k) => { raw[k] = declared[k] + (spare * declared[k]) / othersSum; });

   const total = Object.values(raw).reduce((a, b) => a + b, 0);
   const out: Record<string, number> = {};
   Object.keys(raw).forEach((k) => { out[k] = total > 0 ? round((raw[k] / total) * 100) : 0; });
   return out;
};

/** Global score: weighted average of the blocks, then capped by any global gate. */
export const globalScore = (blocks: BlockScore[], weights: Record<string, number>, gates: Gate[] = []): number => {
   const usable = blocks.filter((b) => b.checksMeasured > 0 && weights[b.block] > 0);
   if (usable.length === 0) { return 0; }
   const weightSum = usable.reduce((a, b) => a + weights[b.block], 0);
   const sum = usable.reduce((a, b) => a + weights[b.block] * b.compliance, 0);
   let score = round(sum / weightSum);
   for (const gate of gates) {
      if (gate.globalCap !== undefined && score > gate.globalCap) { score = gate.globalCap; }
   }
   return score;
};
