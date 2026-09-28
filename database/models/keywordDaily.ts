import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * PoloRank — one row per keyword per day with the FULL context of that check, not just the position.
 *
 * Why it exists: `keyword.history` only keeps `{ date: position }`, and everything that explains a movement
 * (which page ranked, which SERP blocks were present, how deep we looked, who else was there) used to be
 * overwritten on every scrape. None of it can be recovered afterwards, so it is captured day by day.
 */
@Table({
  timestamps: false,
  tableName: 'keyword_daily',
})

class KeywordDaily extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false })
   keyword_id!: number;

   /** 'YYYY-M-D' — same key format as `keyword.history`. */
   @Column({ type: DataType.STRING, allowNull: false })
   date!: string;

   /** 0 = not found within `depth` results. */
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   position!: number;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   target_position!: number;

   /** Which page of the tracked domain ranked that day (empty when not found). */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' })
   url!: string;

   /** JSON array, e.g. ["local_pack","shopping"]. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' })
   serp_features!: string;

   /** How deep we looked. Without it, a position of 0 cannot be interpreted later. */
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   depth!: number;

   /** false when the scrape failed: the position was carried over from the previous day, not measured. */
   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
   measured!: boolean;

   /** JSON array of the top 20: [{ position, url, title }]. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' })
   serp_top!: string;

   /**
    * Google's AI summary: 1 = the domain was cited · 0 = there was a summary and it was not cited ·
    * -1 = there was no summary, or it could not be read.
    *
    * The -1 is not a failure and must never be shown as one. It is what lets the screen count
    * OPPORTUNITIES (days with a summary) instead of calendar days: a domain cited 18 times out of the
    * 22 days a summary appeared is doing well, and "18 of 30" would say the opposite.
    */
   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: -1 })
   ai_cited!: number;

   /** JSON array of the cited sources: [{ position, source, domain, url, title }]. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' })
   ai_references!: string;

   /** The summary text, for the detail panel. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' })
   ai_text!: string;
}

export default KeywordDaily;
