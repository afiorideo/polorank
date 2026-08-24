/**
 * PoloRank — access-code email content (pure, testable).
 */
export const loginCodeEmail = (code: string, appUrl: string) => {
   const subject = `Tu código de acceso a PoloRank: ${code}`;
   const text = [
      `Tu código de acceso a PoloRank es ${code}.`,
      '',
      'Vence en 10 minutos. Si no pediste este código, ignora este correo.',
      '',
      `${appUrl}/login`,
   ].join('\n');
   const html = `
   <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e">
      <p style="font-size:18px;font-weight:700;margin:0 0 16px">PoloRank</p>
      <p style="margin:0 0 12px">Tu código de acceso es:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#5550E0">${code}</p>
      <p style="margin:0 0 8px;color:#64748B;font-size:13px">Vence en 10 minutos. Si no pediste este código, ignora este correo.</p>
      <p style="margin:16px 0 0;font-size:13px"><a href="${appUrl}/login" style="color:#5550E0">${appUrl}/login</a></p>
   </div>`;
   return { subject, text, html };
};

export default loginCodeEmail;
