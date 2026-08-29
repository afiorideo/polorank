import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * PoloRank — monthly search volume per keyword. `keyword.volume` only holds the latest value, so seasonality
 * (graduación, fiestas patrias, navidad…) was being overwritten. Without it, a rise in position cannot be told
 * apart from a rise in actual traffic.
 */
@Table({
  timestamps: false,
  tableName: 'keyword_volume',
})

class KeywordVolume extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false })
   keyword_id!: number;

   /** 'YYYY-MM' */
   @Column({ type: DataType.STRING, allowNull: false })
   month!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   volume!: number;
}

export default KeywordVolume;
