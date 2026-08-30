import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * PoloRank — one row per check per run: the historical series of the audit.
 * `weight` is stored as a snapshot so redefining a check later never rewrites the past.
 */
@Table({ timestamps: false, tableName: 'audit_check_result' })
class AuditCheckResult extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false })
   run_id!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   domain!: string;

   /** Stable slug defined in code, e.g. 'onp.target.title'. Never renamed: it keys the series. */
   @Column({ type: DataType.STRING, allowNull: false })
   check_id!: string;

   @Column({ type: DataType.STRING, allowNull: false })
   block!: string;

   /** Page the check refers to; empty for site-wide checks. */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   url!: string;

   /** pass | fail | partial | na | pending_review */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'na' })
   status!: string;

   /** 0 · 0.5 (semi-automatic ceiling) · 1 */
   @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
   score!: number;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
   weight!: number;

   /** Raw evidence as JSON: what was measured, so any verdict can be argued with. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '{}' })
   evidence!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   reviewed_at!: string | null;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   reviewed_by!: string;

   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' })
   review_note!: string;
}

export default AuditCheckResult;
