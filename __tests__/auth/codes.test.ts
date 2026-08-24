import { generateCode, hashCode, isValidCodeFormat, isValidEmail, normalizeEmail } from '../../utils/auth/codeUtils';
import { loginCodeEmail } from '../../utils/auth/emailTemplate';

describe('códigos de acceso (PoloRank)', () => {
   it('generateCode produce 6 dígitos', () => {
      for (let i = 0; i < 50; i += 1) {
         expect(generateCode()).toMatch(/^\d{6}$/);
      }
   });

   it('hashCode es determinista, depende del correo, del código y del secreto, y no expone el código', () => {
      const h = hashCode('A@B.com', '123456', 's');
      expect(h).toBe(hashCode('a@b.com ', '123456', 's'));
      expect(h).not.toBe(hashCode('a@b.com', '123457', 's'));
      expect(h).not.toBe(hashCode('a@b.com', '123456', 'otro'));
      expect(h).not.toBe(hashCode('c@b.com', '123456', 's'));
      expect(h).not.toContain('123456');
      expect(h).toHaveLength(64);
   });

   it('normalizeEmail y validaciones de formato', () => {
      expect(normalizeEmail('  Afiorid@Gmail.com ')).toBe('afiorid@gmail.com');
      expect(isValidEmail('afiorid@gmail.com')).toBe(true);
      expect(isValidEmail('sin-arroba')).toBe(false);
      expect(isValidCodeFormat('123456')).toBe(true);
      expect(isValidCodeFormat('12345')).toBe(false);
      expect(isValidCodeFormat('12345a')).toBe(false);
      expect(isValidCodeFormat(undefined)).toBe(false);
   });

   it('el correo del código incluye el código, el vencimiento y el enlace de acceso', () => {
      delete process.env.EMAIL_LOGO_URL; // el .env local puede apuntar el logo a otro host; acá probamos el default
      const mail = loginCodeEmail('987654', 'https://polorank.emignia.com');
      expect(mail.subject).toContain('987654');
      expect(mail.text).toContain('987654');
      expect(mail.text).toContain('10 minutos');
      expect(mail.html).toContain('https://polorank.emignia.com/login');
      expect(mail.html).toContain('https://polorank.emignia.com/brand/polo-face-email.png');
      expect(mail.html).not.toContain('cid:');
   });
});
