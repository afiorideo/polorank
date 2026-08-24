import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import ApiUsage from '../../database/models/apiUsage';
import Domain from '../../database/models/domain';
import Keyword from '../../database/models/keyword';
import User from '../../database/models/user';
import { isSuperadmin } from '../../utils/auth/guards';
import { monthBounds, summarizeUsage, usageToCsv, UsageRow, UsageSummary } from '../../utils/usageSummary';
import { parseCredentials } from '../../scrapers/services/dataforseo';
import { authenticate } from '../../utils/verifyUser';
import { getAppSettings } from './settings';

type UsageResponse = {
   summary?: UsageSummary,
   balance?: { usd: number | null, error?: string },
   error?: string | null,
};

const parseDate = (raw: string | string[] | undefined, fallback: Date, endOfDay = false): Date => {
   const s = Array.isArray(raw) ? raw[0] : raw;
   if (!s) { return fallback; }
   const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
   if (!m) { return fallback; }
   const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
   if (endOfDay) { d.setHours(23, 59, 59, 999); }
   return Number.isNaN(d.getTime()) ? fallback : d;
};

/** DataForSEO balance (free endpoint). Never throws; returns null on any problem. */
const fetchDataForSeoBalance = async (): Promise<{ usd: number | null, error?: string }> => {
   try {
      const settings = await getAppSettings();
      if (settings.scraper_type !== 'dataforseo') { return { usd: null, error: 'DataForSEO no es el scraper activo' }; }
      const creds = parseCredentials(settings.scaping_api);
      if (!creds) { return { usd: null, error: 'Credenciales de DataForSEO no configuradas' }; }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
         headers: { Authorization: `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString('base64')}` },
         signal: controller.signal,
      });
      clearTimeout(timer);
      const data: any = await res.json();
      const money = data?.tasks?.[0]?.result?.[0]?.money;
      if (typeof money?.balance !== 'number') { return { usd: null, error: data?.status_message || 'Respuesta inesperada de DataForSEO' }; }
      return { usd: money.balance };
   } catch (error: any) {
      const message = error?.name === 'AbortError' ? 'DataForSEO no respondió a tiempo' : (error?.message || 'Error consultando el saldo');
      return { usd: null, error: message };
   }
};

/**
 * GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv][&balance=1] — superadmin only.
 * Defaults to the current month.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<UsageResponse | string>) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (!isSuperadmin(auth.user)) { return res.status(403).json({ error: 'Solo el administrador total puede ver el consumo.' }); }
   if (req.method !== 'GET') { return res.status(405).json({ error: 'Método no permitido' }); }

   const now = new Date();
   const month = monthBounds(now);
   const from = parseDate(req.query.from, month.from);
   const to = parseDate(req.query.to, month.to, true);
   if (from.getTime() > to.getTime()) { return res.status(400).json({ error: 'El rango de fechas es inválido.' }); }

   try {
      const rawRows = await ApiUsage.findAll({
         where: { created_at: { [Op.between]: [from.toJSON(), to.toJSON()] } },
         order: [['created_at', 'ASC']],
      });
      const rows: UsageRow[] = rawRows.map((r) => r.get({ plain: true }) as UsageRow);

      if (req.query.format === 'csv') {
         const label = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
         res.setHeader('Content-Type', 'text/csv; charset=utf-8');
         res.setHeader('Content-Disposition', `attachment; filename="polorank-consumo-${label}.csv"`);
         return res.status(200).send(`\uFEFF${usageToCsv(rows)}`);
      }

      const [users, domains, keywordCounts] = await Promise.all([
         User.findAll(),
         Domain.findAll(),
         Keyword.findAll({ attributes: ['domain'] }),
      ]);
      const counts: { [d: string]: number } = {};
      keywordCounts.forEach((k) => { counts[k.domain] = (counts[k.domain] || 0) + 1; });
      const domainList = domains.map((d) => ({ domain: d.domain, keywordCount: counts[d.domain] || 0 }));
      const userList = users.map((u) => ({
         ID: u.ID,
         email: u.email,
         role: u.role,
         domain: u.domain_id ? (domains.find((d) => d.ID === u.domain_id)?.domain || null) : null,
         active: !!u.active,
      }));

      const summary = summarizeUsage(rows, from, to, userList, domainList, now);
      const balance = req.query.balance === '1' ? await fetchDataForSeoBalance() : undefined;
      return res.status(200).json({ summary, balance, error: null });
   } catch (error: any) {
      console.log('[ERROR] /api/usage', error?.message || error);
      return res.status(500).json({ error: 'No se pudo calcular el consumo.' });
   }
}
