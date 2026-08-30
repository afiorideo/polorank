/**
 * PoloRank — the Local block: does Google understand where this business operates?
 *
 * Scope, stated up front: without access to the Google Business Profile API the configuration of the listing
 * (verified, category, hours, posts) cannot be measured, and inventing a verdict there would be lying. What CAN
 * be measured is everything the site itself declares, plus the outcome — how often the map pack shows up in the
 * searches this domain is tracked for, which is already captured for free every day.
 */
import type { AuditCheck, AuditInput, CheckVerdict, CrawledPage } from '../types';

/** Schema types that tell Google "this is a business with a physical presence". */
const LOCAL_TYPES = ['LocalBusiness', 'Store', 'Restaurant', 'ProfessionalService', 'HomeAndConstructionBusiness',
   'AutomotiveBusiness', 'HealthAndBeautyBusiness', 'LodgingBusiness', 'TravelAgency', 'ClothingStore', 'HardwareStore'];

const homeOf = (input: AuditInput): CrawledPage | undefined => input.home
   || input.pages.find((p) => p.clickDepth === 0)
   || input.pages[0];

/** A local check reads the home: this is about how the business presents itself, not about every page. */
const onHome = (
   def: Omit<AuditCheck, 'run'>,
   decide: (home: CrawledPage) => CheckVerdict,
): AuditCheck => ({
   ...def,
   run: (input: AuditInput): CheckVerdict[] => {
      const home = homeOf(input);
      if (!home || !home.fetchedOk || !home.parsed) {
         return [{ status: 'na', score: 0, url: home?.url || '', evidence: { motivo: 'No se pudo leer la home' } }];
      }
      return [decide(home)];
   },
});

export const localSchemaCheck = onHome(
   {
      id: 'loc.schema',
      block: 'local',
      kind: 'auto',
      title: 'Declara ser un negocio local (schema)',
      help: 'El schema LocalBusiness le dice a Google que hay un negocio físico detrás del sitio, con dirección y horarios.',
      weight: 3,
   },
   (home) => {
      const tipos = home.parsed?.schemaTypes || [];
      const encontrados = tipos.filter((t) => LOCAL_TYPES.includes(t));
      return {
         status: encontrados.length > 0 ? 'pass' : 'fail',
         score: encontrados.length > 0 ? 1 : 0,
         url: home.url,
         evidence: { tiposLocales: encontrados, todosLosTipos: tipos },
      };
   },
);

export const localAddressCheck = onHome(
   {
      id: 'loc.address',
      block: 'local',
      kind: 'auto',
      title: 'La dirección está declarada en el schema',
      help: 'Sin PostalAddress, Google tiene que adivinar la dirección leyendo el texto de la página.',
      weight: 2,
   },
   (home) => {
      const tiene = (home.parsed?.schemaTypes || []).includes('PostalAddress');
      return { status: tiene ? 'pass' : 'fail', score: tiene ? 1 : 0, url: home.url, evidence: { postalAddress: tiene } };
   },
);

export const localPhoneCheck = onHome(
   {
      id: 'loc.phone',
      block: 'local',
      kind: 'auto',
      title: 'Hay un teléfono en la home',
      help: 'Un enlace tel: o de WhatsApp. Para un negocio local es la vía de contacto principal desde el celular.',
      weight: 2,
   },
   (home) => {
      const tel = home.parsed?.telLinks || 0;
      const wsp = home.parsed?.whatsappLinks || 0;
      return { status: tel + wsp > 0 ? 'pass' : 'fail', score: tel + wsp > 0 ? 1 : 0, url: home.url, evidence: { telefono: tel, whatsapp: wsp } };
   },
);

export const localCityCheck: AuditCheck = {
   id: 'loc.city',
   block: 'local',
   kind: 'auto',
   title: 'La ciudad aparece en el title o el H1 de la home',
   help: 'Para una búsqueda local, nombrar la ciudad donde más pesa es lo que conecta el sitio con la zona.',
   weight: 2,
   run: (input: AuditInput): CheckVerdict[] => {
      const home = homeOf(input);
      const cities = (input.cities || []).filter(Boolean);
      if (cities.length === 0) {
         return [{
            status: 'na',
            score: 0,
            url: home?.url || '',
            evidence: { motivo: 'No hay ciudad configurada para este dominio: definila en los ajustes de auditoría' },
         }];
      }
      if (!home || !home.fetchedOk) {
         return [{ status: 'na', score: 0, url: home?.url || '', evidence: { motivo: 'No se pudo leer la home' } }];
      }
      const texto = `${home.title} ${home.h1.join(' ')}`.toLowerCase();
      const encontradas = cities.filter((c) => texto.includes(c.toLowerCase()));
      return [{
         status: encontradas.length > 0 ? 'pass' : 'fail',
         score: encontradas.length > 0 ? 1 : 0,
         url: home.url,
         evidence: { ciudadesConfiguradas: cities, encontradasEnTitleOH1: encontradas, title: home.title },
      }];
   },
};

/**
 * How often the map pack appears in this domain's tracked searches. It does not pass or fail — it is context,
 * and it is what corrects the weight of the whole block: a business whose searches never show a map pack should
 * not be judged as if local SEO decided its fate.
 */
export const localPackRateCheck: AuditCheck = {
   id: 'loc.pack.rate',
   block: 'local',
   kind: 'auto',
   title: 'Presencia del mapa local en tus búsquedas',
   help: 'Qué proporción de tus búsquedas muestra el bloque de mapa. Ajusta solo cuánto pesa este bloque.',
   weight: 1,
   run: (input: AuditInput): CheckVerdict[] => {
      const withSerp = input.keywords.filter((k) => Array.isArray(k.serpFeatures));
      if (withSerp.length === 0) {
         return [{ status: 'na', score: 0, evidence: { motivo: 'Todavía no hay SERPs guardadas para este dominio' } }];
      }
      const conPack = withSerp.filter((k) => k.serpFeatures.includes('local_pack'));
      const rate = conPack.length / withSerp.length;
      return [{
         // it is informational: a low rate is not a failure, it means local matters less here
         status: 'pass',
         score: 1,
         evidence: {
            busquedasConMapaLocal: conPack.length,
            deUnTotalDe: withSerp.length,
            porcentaje: Math.round(rate * 100),
            efecto: rate < 0.5 ? 'El bloque Local pesa menos para este negocio' : 'El bloque Local pesa más para este negocio',
         },
      }];
   },
};

export default [localSchemaCheck, localAddressCheck, localPhoneCheck, localCityCheck, localPackRateCheck];
