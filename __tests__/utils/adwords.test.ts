import { volumeKey } from '../../utils/adwords';

// el módulo arrastra los modelos de Sequelize, que no arrancan bajo jsdom
jest.mock('../../database/models/keyword', () => ({ __esModule: true, default: { findAll: jest.fn(), update: jest.fn() } }));

describe('utils/adwords — cruce de volúmenes (PoloRank)', () => {
   it('normaliza a minúscula para que coincida con lo que devuelve Google Ads', () => {
      // Google responde 'madera de roble' aunque la keyword esté guardada 'Madera de Roble'
      expect(volumeKey('CL', 'Madera de Roble')).toBe(volumeKey('CL', 'madera de roble'));
      expect(volumeKey('CL', 'Transfer Aeropuerto Temuco Pucón')).toBe('cl:transfer aeropuerto temuco pucón');
   });

   it('sigue separando keywords iguales de países distintos', () => {
      expect(volumeKey('CL', 'regalos corporativos')).not.toBe(volumeKey('BR', 'regalos corporativos'));
   });

   it('conserva acentos y ñ, que sí distinguen keywords', () => {
      expect(volumeKey('CL', 'Madera de Raulí')).toBe('cl:madera de raulí');
      expect(volumeKey('CL', 'vestidos de graduación')).not.toBe(volumeKey('CL', 'vestidos de graduacion'));
   });
});
