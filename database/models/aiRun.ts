import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — una corrida de Visibilidad IA (semanal o a demanda). */
@Table({ timestamps: false, tableName: 'ai_run' })
class AiRun extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   started_at!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   finished_at!: string | null;

   /** 'cron' | 'user:<ID>' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'cron' })
   triggered_by!: string;

   /** 'all' | 'domain:<d>' | 'prompt:<id>' | 'google:<d>' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'all' })
   scope!: string;

   /** 'pending' | 'done' | 'partial' | 'skipped_budget' | 'skipped_no_credentials' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' })
   status!: string;

   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 })
   est_cost_usd!: number;

   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 })
   cost_usd!: number;
}

export default AiRun;
