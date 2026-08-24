import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import Domain from '../../database/models/domain';
import { getAppSettings } from './settings';
import { authenticate, AuthedRequest } from '../../utils/verifyUser';
import { canAccessDomain, canManageKeywords } from '../../utils/auth/guards';
import parseKeywords from '../../utils/parseKeywords';
import { sliceHistory, summarizeHistory } from '../../utils/history';
import { integrateKeywordSCData, readLocalSCData } from '../../utils/searchConsole';
import refreshAndUpdateKeywords from '../../utils/refresh';
import { getKeywordsVolume, updateKeywordsVolumeData } from '../../utils/adwords';
import { removeFromRetryQueue } from '../../utils/scraper';

type KeywordsGetResponse = {
   keywords?: KeywordType[],
   error?: string|null,
}

type KeywordsDeleteRes = {
   domainRemoved?: number,
   keywordsRemoved?: number,
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const auth = await authenticate(req, res);
   const authorized = auth.authorized ? 'authorized' : auth.error;
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   // PoloRank: role guards (spec §6.2). Reads need access to the domain; writes need keyword-management rights on it.
   if (req.method === 'GET') {
      if (!auth.viaApiKey && !canAccessDomain(auth.user, String(req.query.domain || ''))) {
         return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      return getKeywords(req, res);
   }
   if (req.method === 'POST') {
      const incoming: { domain?: string }[] = Array.isArray(req.body?.keywords) ? req.body.keywords : [];
      if (incoming.length === 0 || !incoming.every((k) => canManageKeywords(auth.user, k.domain))) {
         return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      return addKeywords(req, res);
   }
   if (req.method === 'DELETE' || req.method === 'PUT') {
      const ids = String(req.query.id || '').split(',').map((item) => parseInt(item, 10)).filter((n) => Number.isFinite(n) && n > 0);
      const rows: Keyword[] = ids.length > 0 ? await Keyword.findAll({ where: { ID: { [Op.in]: ids } } }) : [];
      if (rows.length === 0 || !rows.every((k) => canManageKeywords(auth.user, k.domain))) {
         return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      return req.method === 'DELETE' ? deleteKeywords(req, res) : updateKeywords(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>) => {
   if (!req.query.domain && typeof req.query.domain !== 'string') {
      return res.status(400).json({ error: 'Domain is Required!' });
   }
   const settings = await getAppSettings();
   const domain = (req.query.domain as string);
   const integratedSC = process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL;
   const { search_console_client_email, search_console_private_key } = settings;
   const domainSCData = integratedSC || (search_console_client_email && search_console_private_key) ? await readLocalSCData(domain) : false;

   try {
      const allKeywords:Keyword[] = await Keyword.findAll({ where: { domain } });
      const keywords: KeywordType[] = parseKeywords(allKeywords.map((e) => e.get({ plain: true })));
      const processedKeywords = keywords.map((keyword) => {
         // PoloRank: the list carries 30 days of history (sparkline) + precomputed stats (best, 7/30/60/90 changes, results received)
         const stats = summarizeHistory(keyword.history, keyword.position, keyword.lastResult);
         const keywordWithSlimHistory = { ...keyword, lastResult: [], history: sliceHistory(keyword.history, 30), stats };
         const finalKeyword = domainSCData ? integrateKeywordSCData(keywordWithSlimHistory, domainSCData) : keywordWithSlimHistory;
         return finalKeyword;
      });
      return res.status(200).json({ keywords: processedKeywords });
   } catch (error) {
      console.log('[ERROR] Getting Domain Keywords for ', domain, error);
      return res.status(400).json({ error: 'Error Loading Keywords for this Domain.' });
   }
};

const addKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>) => {
   const { keywords } = req.body;
   if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // const keywordsArray = keywords.replaceAll('\n', ',').split(',').map((item:string) => item.trim());
      const keywordsToAdd: any = []; // QuickFIX for bug: https://github.com/sequelize/sequelize-typescript/issues/936

      keywords.forEach((kwrd: KeywordAddPayload) => {
         const { keyword, device, country, domain, tags, city } = kwrd;
         const tagsArray = tags ? tags.split(',').map((item:string) => item.trim()) : [];
         const newKeyword = {
            keyword,
            device,
            domain,
            country,
            city,
            position: 0,
            updating: true,
            history: JSON.stringify({}),
            url: '',
            tags: JSON.stringify(tagsArray),
            sticky: false,
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
         };
         keywordsToAdd.push(newKeyword);
      });

      try {
         const newKeywords:Keyword[] = await Keyword.bulkCreate(keywordsToAdd);
         const formattedkeywords = newKeywords.map((el) => el.get({ plain: true }));
         const keywordsParsed: KeywordType[] = parseKeywords(formattedkeywords);

         // Queue the SERP Scraping Process
         const settings = await getAppSettings();
         // PoloRank: the initial check must honour the domain's scrape strategy (SerpBear ignored it here) and log who added them
         const domainRows: Domain[] = await Domain.findAll();
         const domainList: DomainType[] = domainRows.map((d) => d.get({ plain: true }));
         const { authUser } = req as AuthedRequest;
         refreshAndUpdateKeywords(newKeywords, settings, domainList, authUser ? `user:${authUser.uid}` : 'cron');

         // Update the Keyword Volume
         const { adwords_account_id, adwords_client_id, adwords_client_secret, adwords_developer_token } = settings;
         if (adwords_account_id && adwords_client_id && adwords_client_secret && adwords_developer_token) {
            const keywordsVolumeData = await getKeywordsVolume(keywordsParsed);
            if (keywordsVolumeData.volumes !== false) {
               await updateKeywordsVolumeData(keywordsVolumeData.volumes);
            }
         }

         return res.status(201).json({ keywords: keywordsParsed });
      } catch (error) {
         console.log('[ERROR] Adding New Keywords ', error);
         return res.status(400).json({ error: 'Could Not Add New Keyword!' });
      }
   } else {
      return res.status(400).json({ error: 'Necessary Keyword Data Missing' });
   }
};

const deleteKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsDeleteRes>) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }
   console.log('req.query.id: ', req.query.id);

   try {
      const keywordsToRemove = (req.query.id as string).split(',').map((item) => parseInt(item, 10));
      const removeQuery = { where: { ID: { [Op.in]: keywordsToRemove } } };
      const removedKeywordCount: number = await Keyword.destroy(removeQuery);

      // remove keyword from retry queue if exists
      await Promise.all(keywordsToRemove.map((keywordID) => removeFromRetryQueue(keywordID)));

      return res.status(200).json({ keywordsRemoved: removedKeywordCount });
   } catch (error) {
      console.log('[ERROR] Removing Keyword. ', error);
      return res.status(400).json({ error: 'Could Not Remove Keyword!' });
   }
};

const updateKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }
   if (req.body.sticky === undefined && !req.body.tags === undefined) {
      return res.status(400).json({ error: 'keyword Payload Missing!' });
   }
   const keywordIDs = (req.query.id as string).split(',').map((item) => parseInt(item, 10));
   const { sticky, tags } = req.body;

   try {
      let keywords: KeywordType[] = [];
      if (sticky !== undefined) {
         await Keyword.update({ sticky }, { where: { ID: { [Op.in]: keywordIDs } } });
         const updateQuery = { where: { ID: { [Op.in]: keywordIDs } } };
         const updatedKeywords:Keyword[] = await Keyword.findAll(updateQuery);
         const formattedKeywords = updatedKeywords.map((el) => el.get({ plain: true }));
          keywords = parseKeywords(formattedKeywords);
         return res.status(200).json({ keywords });
      }
      if (tags) {
         const tagsKeywordIDs = Object.keys(tags);
         const multipleKeywords = tagsKeywordIDs.length > 1;
         for (const keywordID of tagsKeywordIDs) {
            const selectedKeyword = await Keyword.findOne({ where: { ID: keywordID } });
            const currentTags = selectedKeyword && selectedKeyword.tags ? JSON.parse(selectedKeyword.tags) : [];
            const mergedTags = Array.from(new Set([...currentTags, ...tags[keywordID]]));
            if (selectedKeyword) {
               await selectedKeyword.update({ tags: JSON.stringify(multipleKeywords ? mergedTags : tags[keywordID]) });
            }
         }
         return res.status(200).json({ keywords });
      }
      return res.status(400).json({ error: 'Invalid Payload!' });
   } catch (error) {
      console.log('[ERROR] Updating Keyword. ', error);
      return res.status(200).json({ error: 'Error Updating keywords!' });
   }
};
