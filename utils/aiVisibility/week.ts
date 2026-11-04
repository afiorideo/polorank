/** Lunes (UTC) de la semana ISO de `d`, 'YYYY-MM-DD'. Una semana = un dato en Visibilidad IA. */
export const weekOf = (d: Date): string => {
   const day = d.getUTCDay() || 7; // domingo = 7
   const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)));
   return monday.toISOString().slice(0, 10);
};
export default weekOf;
