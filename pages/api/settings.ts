import { writeFile, readFile, rename, stat } from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import Cryptr from 'cryptr';
import getConfig from 'next/config';
import { authenticate } from '../../utils/verifyUser';
import { isSuperadmin } from '../../utils/auth/guards';
import allScrapers from '../../scrapers/index';

type SettingsGetResponse = {
   settings?: object | null,
   error?: string,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const auth = await authenticate(req, res);
   const authorized = auth.authorized ? 'authorized' : auth.error;
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (req.method === 'GET') {
      // PoloRank: non-superadmins only get the harmless subset (no API keys, no SMTP, no tokens)
      if (!auth.viaApiKey && !isSuperadmin(auth.user)) { return getPublicSettings(res); }
      return getSettings(req, res);
   }
   if (req.method === 'PUT') {
      if (!isSuperadmin(auth.user)) { return res.status(403).json({ error: 'No tienes permiso para esta acción.' }); }
      return updateSettings(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getSettings = async (req: NextApiRequest, res: NextApiResponse<SettingsGetResponse>) => {
   const settings = await getAppSettings();
   if (settings) {
      const { publicRuntimeConfig } = getConfig();
      const version = publicRuntimeConfig?.version;
      return res.status(200).json({ settings: { ...settings, version } });
   }
   return res.status(400).json({ error: 'Error Loading Settings!' });
};

const updateSettings = async (req: NextApiRequest, res: NextApiResponse<SettingsGetResponse>) => {
   const { settings } = req.body || {};
   // console.log('### settings: ', settings);
   if (!settings) {
      return res.status(200).json({ error: 'Settings Data not Provided!' });
   }
   try {
      const cryptr = new Cryptr(process.env.SECRET as string);
      const scaping_api = settings.scaping_api ? cryptr.encrypt(settings.scaping_api.trim()) : '';
      const smtp_password = settings.smtp_password ? cryptr.encrypt(settings.smtp_password.trim()) : '';
      const search_console_client_email = settings.search_console_client_email ? cryptr.encrypt(settings.search_console_client_email.trim()) : '';
      const search_console_private_key = settings.search_console_private_key ? cryptr.encrypt(settings.search_console_private_key.trim()) : '';
      const adwords_client_id = settings.adwords_client_id ? cryptr.encrypt(settings.adwords_client_id.trim()) : '';
      const adwords_client_secret = settings.adwords_client_secret ? cryptr.encrypt(settings.adwords_client_secret.trim()) : '';
      const adwords_developer_token = settings.adwords_developer_token ? cryptr.encrypt(settings.adwords_developer_token.trim()) : '';
      const adwords_account_id = settings.adwords_account_id ? cryptr.encrypt(settings.adwords_account_id.trim()) : '';

      const securedSettings = {
         ...settings,
         scaping_api,
         smtp_password,
         search_console_client_email,
         search_console_private_key,
         adwords_client_id,
         adwords_client_secret,
         adwords_developer_token,
         adwords_account_id,
      };

      await writeFile(`${process.cwd()}/data/settings.json`, JSON.stringify(securedSettings), { encoding: 'utf-8' });
      return res.status(200).json({ settings });
   } catch (error) {
      console.log('[ERROR] Updating App Settings. ', error);
      return res.status(200).json({ error: 'Error Updating Settings!' });
   }
};

const safeReadJSON = async (filePath: string, fallback: any): Promise<any> => {
   try {
      const raw = await readFile(filePath, { encoding: 'utf-8' });
      return raw ? JSON.parse(raw) : fallback;
   } catch (error: any) {
      const fileExists = await stat(filePath).then(() => true).catch(() => false);
      if (fileExists) {
         // File exists but is corrupt — back it up instead of silently overwriting
         const backupPath = `${filePath}.${Date.now()}.corrupt`;
         console.log(`[WARN] Corrupt JSON detected in ${filePath}. Backing up to ${backupPath}`);
         await rename(filePath, backupPath).catch(() => {});
      }
      await writeFile(filePath, JSON.stringify(fallback), { encoding: 'utf-8' }).catch(() => {});
      return fallback;
   }
};

export const getAppSettings = async () : Promise<SettingsType> => {
   const screenshotAPIKey = process.env.SCREENSHOT_API || '69408-serpbear';
   const defaultSettings: SettingsType = {
      scraper_type: 'none',
      notification_interval: 'never',
      notification_email: '',
      notification_email_from: '',
      notification_email_from_name: 'PoloRank',
      smtp_server: '',
      smtp_port: '',
      smtp_username: '',
      smtp_password: '',
      scrape_retry: false,
      screenshot_key: screenshotAPIKey,
      search_console: true,
      search_console_client_email: '',
      search_console_private_key: '',
      keywordsColumns: ['Best', 'History', 'Volume', 'Search Console'],
      trackingColumns: ['Evol', 'Volume', 'Changes', 'Snippets', 'Best', 'Search Console'],
      scrape_strategy: 'basic',
      scrape_pagination_limit: 5,
      scrape_smart_full_fallback: false,
   };

   const settings: SettingsType = await safeReadJSON(`${process.cwd()}/data/settings.json`, defaultSettings);
   const failedQueue: string[] = await safeReadJSON(`${process.cwd()}/data/failed_queue.json`, []);

   let decryptedSettings = settings;
   try {
      const cryptr = new Cryptr(process.env.SECRET as string);
      const scaping_api = settings.scaping_api ? cryptr.decrypt(settings.scaping_api) : '';
      const smtp_password = settings.smtp_password ? cryptr.decrypt(settings.smtp_password) : '';
      const search_console_client_email = settings.search_console_client_email ? cryptr.decrypt(settings.search_console_client_email) : '';
      const search_console_private_key = settings.search_console_private_key ? cryptr.decrypt(settings.search_console_private_key) : '';
      const adwords_client_id = settings.adwords_client_id ? cryptr.decrypt(settings.adwords_client_id) : '';
      const adwords_client_secret = settings.adwords_client_secret ? cryptr.decrypt(settings.adwords_client_secret) : '';
      const adwords_developer_token = settings.adwords_developer_token ? cryptr.decrypt(settings.adwords_developer_token) : '';
      const adwords_account_id = settings.adwords_account_id ? cryptr.decrypt(settings.adwords_account_id) : '';

      decryptedSettings = {
         ...settings,
         scaping_api,
         smtp_password,
         search_console_client_email,
         search_console_private_key,
         search_console_integrated: !!(process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL)
         || !!(search_console_client_email && search_console_private_key),
         available_scrapers: allScrapers.map((scraper) => ({ label: scraper.name, value: scraper.id, allowsCity: !!scraper.allowsCity })),
         failed_queue: failedQueue,
         screenshot_key: screenshotAPIKey,
         adwords_client_id,
         adwords_client_secret,
         adwords_developer_token,
         adwords_account_id,
         scrape_strategy: settings.scrape_strategy || 'basic',
         scrape_pagination_limit: settings.scrape_pagination_limit || 5,
         scrape_smart_full_fallback: settings.scrape_smart_full_fallback || false,
      };
   } catch (error) {
      console.log('Error Decrypting Settings API Keys!');
   }

   return decryptedSettings;
};

/** PoloRank: settings visible to domain admins/users — only what the UI needs to render, nothing secret. */
const getPublicSettings = async (res: NextApiResponse<SettingsGetResponse>) => {
   try {
      const settings = await getAppSettings();
      const publicSettings = {
         scraper_type: settings.scraper_type,
         keywordsColumns: settings.keywordsColumns,
         trackingColumns: settings.trackingColumns,
         available_scrapers: settings.available_scrapers,
         search_console_integrated: settings.search_console_integrated,
         version: settings.version,
         scrape_interval: settings.scrape_interval,
         notification_interval: 'never',
      };
      return res.status(200).json({ settings: publicSettings });
   } catch (error) {
      return res.status(500).json({ error: 'Error loading settings' });
   }
};
