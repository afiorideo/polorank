import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * PoloRank — one row per crawled page per run.
 * `fetched_ok = false` marks a page we could not read: it is never scored as a zero, it lowers coverage instead.
 */
@Table({ timestamps: false, tableName: 'audit_page' })
class AuditPage extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false })
   run_id!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   domain!: string;

   @Column({ type: DataType.STRING, allowNull: false })
   url!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   status_code!: number;

   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
   fetched_ok!: boolean;

   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' })
   title!: string;

   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' })
   h1!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   word_count!: number;

   /** Clicks away from the home page. */
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   click_depth!: number;

   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
   indexable!: boolean;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   size_bytes!: number;
}

export default AuditPage;
