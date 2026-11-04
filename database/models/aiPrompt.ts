import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — un prompt (frase en lenguaje natural) que se pregunta a las IAs. */
@Table({ timestamps: false, tableName: 'ai_prompt' })
class AiPrompt extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.STRING, allowNull: false })
   domain!: string;

   @Column({ type: DataType.STRING(500), allowNull: false })
   prompt!: string;

   /** JSON string[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' })
   tags!: string;

   @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
   active!: boolean;

   /** Override por prompt; null = usa el del dominio. */
   @Column({ type: DataType.INTEGER, allowNull: true })
   location_code!: number | null;

   @Column({ type: DataType.STRING, allowNull: true })
   language_code!: string | null;

   @Column({ type: DataType.STRING, allowNull: true })
   country_iso!: string | null;

   @Column({ type: DataType.STRING, allowNull: false })
   created_at!: string;
}

export default AiPrompt;
