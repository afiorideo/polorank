import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — one row per audit execution. `status = 'running'` doubles as the lock that prevents a second run. */
@Table({ timestamps: false, tableName: 'audit_run' })
class AuditRun extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   domain!: string;

   @Column({ type: DataType.STRING, allowNull: false })
   started_at!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   finished_at!: string | null;

   /** running | ok | partial | error */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'running' })
   status!: string;

   /** 'cron' or 'user:<uid>' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'cron' })
   triggered_by!: string;

   /** Business profile used for the weights: local | local_national | ecommerce | services */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'local_national' })
   profile!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   pages_crawled!: number;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   duration_ms!: number;

   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' })
   error!: string;
}

export default AuditRun;
