import { Table, Model, Column, DataType, PrimaryKey } from 'sequelize-typescript';

/** PoloRank — una respuesta de una IA a un prompt (una repetición). */
@Table({ timestamps: false, tableName: 'ai_answer' })
class AiAnswer extends Model {
   @PrimaryKey
   @Column({ type: DataType.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true })
   ID!: number;

   @Column({ type: DataType.INTEGER, allowNull: false }) run_id!: number;

   @Column({ type: DataType.INTEGER, allowNull: false }) prompt_id!: number;

   @Column({ type: DataType.STRING, allowNull: false }) domain!: string;

   /** 'chatgpt' | 'gemini' | 'ai_mode' | 'perplexity' */
   @Column({ type: DataType.STRING, allowNull: false }) engine!: string;

   @Column({ type: DataType.INTEGER, allowNull: false }) rep!: number;

   /** Lunes de la semana ISO, 'YYYY-MM-DD' */
   @Column({ type: DataType.STRING, allowNull: false }) week!: string;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' }) task_id!: string;

   /** 'pending' | 'ok' | 'error' */
   @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'pending' }) status!: string;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) mentioned!: number;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) cited!: number;

   @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) position!: number;

   /** JSON string[] en orden de aparición */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' }) brands!: string;

   /** JSON {domain,url,title}[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' }) sources!: string;

   /** JSON string[] */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '[]' }) fan_out!: string;

   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' }) text!: string;

   /** Respuesta completa de DataForSEO: zlib + base64. Se purga a las 26 semanas. */
   @Column({ type: DataType.TEXT, allowNull: false, defaultValue: '' }) raw!: string;

   @Column({ type: DataType.DECIMAL(10, 6), allowNull: false, defaultValue: 0 }) cost_usd!: number;

   @Column({ type: DataType.STRING, allowNull: false, defaultValue: '' }) error!: string;

   @Column({ type: DataType.STRING, allowNull: false }) created_at!: string;
}

export default AiAnswer;
