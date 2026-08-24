import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import { authenticate } from '../../utils/verifyUser';
import { isSuperadmin } from '../../utils/auth/guards';

type MigrationGetResponse = {
   hasMigrations: boolean,
}

type MigrationPostResponse = {
   migrated: boolean,
   error?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const auth = await authenticate(req, res);
   const authorized = auth.authorized ? 'authorized' : auth.error;
   const allowed = authorized === 'authorized' && isSuperadmin(auth.user);
   if (allowed && req.method === 'GET') {
      await db.sync();
      return getMigrationStatus(req, res);
   }
   if (allowed && req.method === 'POST') {
      return migrateDatabase(req, res);
   }
   return res.status(401).json({ error: authorized });
}

const getMigrationStatus = async (req: NextApiRequest, res: NextApiResponse<MigrationGetResponse>) => {
   const sequelize = new Sequelize({ dialect: 'sqlite', storage: './data/database.sqlite', logging: false });
   const umzug = new Umzug({
      migrations: { glob: 'database/migrations/*.js' },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: undefined,
   });
   const migrations = await umzug.pending();
   // console.log('migrations :', migrations);
   return res.status(200).json({ hasMigrations: migrations.length > 0 });
};

const migrateDatabase = async (req: NextApiRequest, res: NextApiResponse<MigrationPostResponse>) => {
   const sequelize = new Sequelize({ dialect: 'sqlite', storage: './data/database.sqlite', logging: false });
   const umzug = new Umzug({
      migrations: { glob: 'database/migrations/*.js' },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: undefined,
   });
   const migrations = await umzug.up();
   console.log('[Updated] migrations :', migrations);
   return res.status(200).json({ migrated: true });
};
