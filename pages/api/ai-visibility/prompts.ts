import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import AiPrompt from '../../../database/models/aiPrompt';
import { getAppSettings } from '../settings';
import { authenticate } from '../../../utils/verifyUser';
import { canAccessDomain, canManageKeywords } from '../../../utils/auth/guards';

const clean = (b: any) => ({
   prompt: typeof b?.prompt === 'string' ? b.prompt.trim().slice(0, 500) : '',
   tags: JSON.stringify(Array.isArray(b?.tags) ? b.tags.filter((t: unknown) => typeof t === 'string' && t.trim()).map((t: string) => t.trim()) : []),
});

/** CRUD de prompts por dominio. DELETE desactiva (conserva el historial de respuestas). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   if (!auth.authorized) { return res.status(401).json({ error: auth.error }); }
   const domain = (req.query.domain as string) || '';
   if (!domain) { return res.status(400).json({ error: 'Falta indicar el dominio.' }); }
   if (!canAccessDomain(auth.user, domain)) { return res.status(403).json({ error: 'No tienes acceso a este dominio.' }); }
   if (req.method !== 'GET' && !canManageKeywords(auth.user, domain)) {
      return res.status(403).json({ error: 'No tienes permiso para editar los prompts de este dominio.' });
   }

   try {
      const maxPrompts = (await getAppSettings()).ai_max_prompts ?? 5;
      const activeCount = () => AiPrompt.count({ where: { domain, active: true } });

      if (req.method === 'GET') {
         const rows = await AiPrompt.findAll({ where: { domain, active: true }, order: [['ID', 'ASC']] });
         return res.status(200).json({ prompts: rows.map((r) => r.get({ plain: true })), max: maxPrompts });
      }
      if (req.method === 'POST') {
         const { prompt, tags } = clean(req.body);
         if (!prompt) { return res.status(400).json({ error: 'Falta el texto del prompt.' }); }
         if (await activeCount() >= maxPrompts) { return res.status(400).json({ error: `Máximo ${maxPrompts} prompts por dominio` }); }
         const row = await AiPrompt.create({ domain, prompt, tags, active: true, created_at: new Date().toJSON() });
         return res.status(200).json({ prompt: row.get({ plain: true }) });
      }
      const id = parseInt(String(req.method === 'PUT' ? req.body?.id : req.query.id), 10);
      const row = Number.isNaN(id) ? null : await AiPrompt.findOne({ where: { ID: id, domain } });
      if (!row) { return res.status(404).json({ error: 'Prompt no encontrado.' }); }
      if (req.method === 'PUT') {
         const { prompt, tags } = clean(req.body);
         if (!prompt) { return res.status(400).json({ error: 'Falta el texto del prompt.' }); }
         await row.update({ prompt, tags });
         return res.status(200).json({ prompt: row.get({ plain: true }) });
      }
      if (req.method === 'DELETE') {
         await row.update({ active: false });
         return res.status(200).json({ deleted: true });
      }
      return res.status(405).json({ error: 'Método no permitido.' });
   } catch (error) {
      console.log('[ERROR] Visibilidad IA prompts: ', error);
      return res.status(400).json({ error: 'Error al procesar los prompts.' });
   }
}
