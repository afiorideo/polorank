import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * PoloRank — one row per scraper API request (DataForSEO). Feeds the "Consumo" panel.
 */
@Table({
  timestamps: false,
  tableName: 'api_usage',
})

class ApiUsage extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   created_at!: string;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   scraper!: string;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   domain!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   keyword_id!: number;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   keyword!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   depth!: number;

   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 })
   cost_usd!: number;

   /** 'cron' or 'user:<ID>' (manual refresh). */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'cron' })
   triggered_by!: string;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'ok' })
   status!: string;
}

export default ApiUsage;
