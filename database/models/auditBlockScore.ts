import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — denormalised block scores, so painting the donuts is one cheap read. */
@Table({ timestamps: false, tableName: 'audit_block_score' })
class AuditBlockScore extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false })
   run_id!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   domain!: string;

   @Column({ type: DataType.STRING, allowNull: false })
   block!: string;

   /** The big number of the donut: weighted average over what could be measured. */
   @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
   compliance!: number;

   /** The second number: how much of the block was actually assessed. Without it the first one can mislead. */
   @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
   coverage!: number;

   /** Share of the global score this block carries, already corrected by evidence. */
   @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
   weight!: number;

   /** Which gate capped the block, when one did (e.g. 'noindex'). */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   capped_by!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   checks_total!: number;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   checks_measured!: number;
}

export default AuditBlockScore;
