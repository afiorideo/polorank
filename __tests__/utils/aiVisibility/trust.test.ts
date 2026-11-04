/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { organicHosts, serpTrust } from '../../../utils/aiVisibility/trust';

const fx = (f: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ai', f), 'utf8'));
const serper = fx('serper-1.json').organic.map((o: any) => o.link.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]);

describe('serpTrust (prueba real 2026-11-04)', () => {
   it('dfs-1 envenenada → 0', () => { expect(serpTrust(organicHosts(fx('dfs-1.json')[0].items), serper)).toBe(0); });
   it('dfs-2 normal → 1', () => { expect(serpTrust(organicHosts(fx('dfs-2.json')[0].items), serper)).toBe(1); });
   it('dfs-3 envenenada → 0', () => { expect(serpTrust(organicHosts(fx('dfs-3.json')[0].items), serper)).toBe(0); });
   it('sin datos de Serper → null', () => { expect(serpTrust(['a.cl'], [])).toBeNull(); });
});
