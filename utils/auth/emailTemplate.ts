/**
 * PoloRank — access-code email content (pure, testable).
 */
/** Public URL of the email logo (served by the app itself); no attachments so mail clients show nothing extra. */
export const logoUrl = (appUrl: string): string => `${appUrl}/brand/polo-face-email.png`;
export const loginCodeEmail = (code: string, appUrl: string) => {
   const subject = `Tu código de acceso a PoloRank: ${code}`;
   const text = [
      `Tu código de acceso a PoloRank es ${code}.`,
      '',
      'Vence en 10 minutos. Si no pediste este código, ignora este correo.',
      '',
      `${appUrl}/login`,
   ].join('\n');
   // The logo is loaded from the app's public URL (Gmail shows remote images by default) — no attachment in the email.
   const html = `
   <div style="background:#F4F4FA;padding:32px 16px;font-family:Inter,Arial,Helvetica,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
         <div style="padding:20px 24px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center">
            <img src="${logoUrl(appUrl)}" alt="PoloRank" width="44" height="49"
               style="display:inline-block;vertical-align:middle;margin-right:12px">
            <span style="display:inline-block;vertical-align:middle;font-size:22px;font-weight:700;color:#1A1A2E">
               Polo<span style="color:#6C63FF">Rank</span>
            </span>
         </div>
         <div style="padding:24px;color:#1A1A2E">
            <p style="margin:0 0 12px;font-size:15px">Hola, este es tu código de acceso a PoloRank:</p>
            <p style="font-size:36px;font-weight:700;letter-spacing:10px;margin:0 0 16px;color:#5550E0">${code}</p>
            <p style="margin:0 0 8px;color:#64748B;font-size:13px">Vence en 10 minutos. Si no pediste este código, ignora este correo.</p>
            <p style="margin:20px 0 0;font-size:13px">
               <a href="${appUrl}/login" style="color:#5550E0;font-weight:600">Ingresar a PoloRank</a>
            </p>
         </div>
         <div style="padding:14px 24px;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:12px">
            PoloRank · Tracking de posiciones SEO · <a href="https://emignia.com" style="color:#94A3B8">Emignia</a>
         </div>
      </div>
   </div>`;
   return { subject, text, html };
};

export default loginCodeEmail;
