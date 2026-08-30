/**
 * PoloRank — the check catalogue.
 *
 * Adding a check is adding an entry to one array in one file. Nothing else in the system needs to know it
 * exists: the engine runs whatever is here, the scoring reads the block and weight off each verdict, and the
 * UI renders whatever comes back. That is the whole point of the contract in `types.ts`.
 *
 * A new check simply has no rows before its first run. The past is never recalculated and never back-filled
 * with a fabricated verdict — the screen says "sin datos antes de" instead, the same lesson the `101` taught.
 */
import type { AuditCheck } from './types';
import pageChecks from './checks/page';
import trackingChecks from './checks/tracking';
import localChecks from './checks/local';

export const CATALOG: AuditCheck[] = [...pageChecks, ...trackingChecks, ...localChecks];

export const checkById = (id: string): AuditCheck | undefined => CATALOG.find((c) => c.id === id);

export default CATALOG;
