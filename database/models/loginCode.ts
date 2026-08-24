import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/**
 * PoloRank — one-time 6-digit login codes sent by email. Only the hash is stored.
 */
@Table({
  timestamps: false,
  tableName: 'login_code',
})

class LoginCode extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   email!: string;

   @Column({ type: DataType.STRING, allowNull: false })
   code_hash!: string;

   @Column({ type: DataType.STRING, allowNull: false })
   expires_at!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
   attempts!: number;

   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
   used!: boolean;

   @Column({ type: DataType.STRING, allowNull: false })
   created_at!: string;
}

export default LoginCode;
