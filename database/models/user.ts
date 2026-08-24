import { Table, Model, Column, DataType, PrimaryKey, Unique } from 'sequelize-typescript';

/**
 * PoloRank — application users. Roles:
 * - superadmin: everything (seeded from ADMIN_EMAIL, cannot be removed/downgraded from the UI)
 * - domain_admin: ONE domain, can view + add/remove keywords
 * - domain_user: ONE domain, read-only
 */
@Table({
  timestamps: false,
  tableName: 'user',
})

class User extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Unique
   @Column({ type: DataType.STRING, allowNull: false, unique: true })
   email!: string;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'domain_user' })
   role!: string;

   @Column({ type: DataType.INTEGER, allowNull: true })
   domain_id!: number | null;

   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
   active!: boolean;

   @Column({ type: DataType.STRING, allowNull: false })
   created_at!: string;

   @Column({ type: DataType.STRING, allowNull: true })
   last_login!: string | null;
}

export default User;
