import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../../database/database';
import AiAnswer from '../../../database/models/aiAnswer';
import AiPrompt from '../../../database/models/aiPrompt';
import AiRun from '../../../database/models/aiRun';
import Domain from '../../../database/models/domain';
import { getAppSettings } from '../settings';
import { authenticate } from '../../../utils/verifyUser';
import { canAccessDomain } from '../../../utils/auth/guards';
import { parseAiSettings } from '../../../utils/aiVisibility/config';
import { monthSpend } from '../../../utils/aiVisibility/budget';
import { buildPanel } from '../../../utils/aiVisibility/panel';
import type { AiVisibilityData } from '../../../utils/aiVisibility/panel';

export type { AiVisibilityData, EngineCell } from '../../../utils/aiVisibility/panel';

/** Próximo lunes 09:00 UTC (estrictamente posterior a `now`), ISO. */
export const nextMonday9utc = (now: Date = new Date()): string => {
   const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9));
   d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
   if (d <= now) { d.setUTCDate(d.getUTCDate() + 7); }
   return d.toJSON();
};

/** Panel de Visibilidad IA. Con `&prompt=<id>&full=1` devuelve las respuestas completas de la última semana. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   if (req.method !== 'GET') { return res.status(405).json({ error: 'Método no permitido.' }); }
   const domain = (req.query.domain as string) || '';
   if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }
   if (!canAccessDomain(auth.user, domain)) { return res.status(403).json({ error: 'No tienes acceso a este dominio.' }); }

   try {
      const weekRows = await AiAnswer.findAll({
         attributes: ['week'], where: { domain }, group: ['week'], order: [['week', 'DESC']], limit: 12,
      });
      const weeks = weekRows.map((r) => r.get('week') as string);

      if (req.query.full === '1' && req.query.prompt) {
         const promptId = parseInt(req.query.prompt as string, 10);
         const answers = weeks.length ? await AiAnswer.findAll({
            where: { domain, prompt_id: promptId, week: weeks[0] },
            attributes: { exclude: ['raw'] },
            order: [['engine', 'ASC'], ['rep', 'ASC']],
         }) : [];
         return res.status(200).json({ week: weeks[0] || null, answers: answers.map((a) => a.get({ plain: true })) });
      }

      const domainRow = await Domain.findOne({ where: { domain } });
      const cfg = parseAiSettings(domainRow?.get('ai_settings') as string, domain);
      const settings = await getAppSettings();
      const prompts = await AiPrompt.findAll({ where: { domain, active: true }, order: [['ID', 'ASC']] });
      const answers = weeks.length ? await AiAnswer.findAll({
         where: { domain, week: { [Op.in]: weeks }, status: 'ok' },
         attributes: ['prompt_id', 'engine', 'rep', 'week', 'status', 'mentioned', 'cited', 'position', 'brands', 'sources'],
      }) : [];
      const scopes = ['all', `domain:${domain}`, `google:${domain}`, ...prompts.map((p) => `prompt:${p.get('ID')}`)];
      const lastRun = await AiRun.findOne({ where: { scope: { [Op.in]: scopes } }, order: [['ID', 'DESC']] });

      const panel = buildPanel(
         prompts.map((p) => p.get({ plain: true })) as any,
         answers.map((a) => a.get({ plain: true })) as any,
         weeks,
         cfg.brand_variants[0],
         cfg,
      );
      const data: AiVisibilityData = {
         lastRun: lastRun ? { started_at: lastRun.get('started_at') as string, status: lastRun.get('status') as string } : null,
         nextRun: nextMonday9utc(),
         monthSpend: await monthSpend(),
         budget: settings.ai_monthly_budget_usd ?? 2,
         ...panel,
      };
      return res.status(200).json(data);
   } catch (error) {
      console.log('[ERROR] Visibilidad IA data: ', error);
      return res.status(400).json({ error: 'Error al armar el panel.' });
   }
}
