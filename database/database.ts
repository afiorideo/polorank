import { Sequelize } from 'sequelize-typescript';
import sqlite3 from 'sqlite3';
import { applyPragmas } from './pragmas';
import Domain from './models/domain';
import Keyword from './models/keyword';
import ApiUsage from './models/apiUsage';
import User from './models/user';
import LoginCode from './models/loginCode';
import KeywordDaily from './models/keywordDaily';
import KeywordVolume from './models/keywordVolume';

const connection = new Sequelize({
   dialect: 'sqlite',
   host: '0.0.0.0',
   username: process.env.USER_NAME ? process.env.USER_NAME : process.env.USER,
   password: process.env.PASSWORD,
   database: 'sequelize',
   dialectModule: sqlite3,
   pool: {
      max: 5,
      min: 0,
      idle: 10000,
   },
   logging: false,
   models: [Domain, Keyword, ApiUsage, User, LoginCode, KeywordDaily, KeywordVolume],
   storage: './data/database.sqlite',
});

// PoloRank: WAL + busy_timeout, issued before any handler runs. Fire and forget — applyPragmas never rejects.
applyPragmas(connection);

export default connection;
