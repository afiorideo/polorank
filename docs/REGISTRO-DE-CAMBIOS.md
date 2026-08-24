# PoloRank — Registro de cambios en producción

Producción: `https://polorank.emignia.com` · VPS #1 Hetzner (`91.99.66.186`) · Dokploy proyecto `polorank` (`rohbp1UZRchafE1ne_ybA`), app `polorank` (`-5Cjh9TI9WEauo5Mxbiwv`, servicio Swarm `polorank-7iug3c`), volumen `polorank-data` → `/app/data`, dominio `polorank.emignia.com` (Let's Encrypt, puerto 3000).
Repo: `github.com/afiorideo/polorank` (rama `main`, auto-deploy al push).

| ID | Fecha | Qué arregla / objetivo | Qué se cambió | Respaldo | OK Fabián |
|---|---|---|---|---|---|
| POLO-2026-08-24-01 | 2026-08-24 | Crear la app en el Dokploy del VPS #1 | Proyecto `polorank`, app desde GitHub (https, `main`), build `Dockerfile`, volumen `polorank-data`→`/app/data`, 12 variables de entorno (SECRET/APIKEY reutilizados de SerpBear por decisión de Fabián para conservar las claves cifradas de `settings.json`; SMTP Zoho `hola@emignia.com`; `ADMIN_EMAIL`; `EMAIL_LOGO_URL`) | App nueva, sin estado previo. Margen VPS #1 tras arranque: ~1,7 GB + 2 GB swap | ✔ 2026-08-24 |
| POLO-2026-08-24-02 | 2026-08-24 | Dominio con SSL | `polorank.emignia.com` en Dokploy (`domainId afnC5n0Q6EyyRNHtGgi2c`), HTTPS Let's Encrypt; registro Cloudflare creado por Fabián | Reversible (borrar dominio) | ✔ 2026-08-24 |
| POLO-2026-08-24-03 | 2026-08-24 | Primer despliegue | Build ~5 min, contenedor 95 MiB. Verificado: `/login` 200, `/api/auth/me` 401, `/domains` → `/login`, logo del correo servido, correo real de acceso enviado a afiorid@gmail.com | — | ✔ 2026-08-24 |
| POLO-2026-08-24-04 | 2026-08-24 | Migrar datos de SerpBear (VPS #2) | Copia fresca de `/app/data` (base, settings, cachés SC/Ideas) → volumen de PoloRank; reinicio del servicio; migraciones `serp_features`, `api_usage`, `user`/`login_code` aplicadas. Verificado por API: 4 dominios, 11 keywords con 12 días de historial | `Laboratorio/polo-rank/backups/serpbear-data-2026-08-24-1629.tgz` (+ estado previo vacío en `/tmp/polorank-data-before-*` del VPS #1) | ✔ 2026-08-24 |
| POLO-2026-08-24-05 | 2026-08-24 | Configuración inicial de scraping | Configuración → Scraper: DataForSEO con `login:password` de `Seo-Admin-Central`, estrategia `basic`. Refresco manual de prueba de 2 keywords de ammo.cl: pos. 2 y 3, features guardadas, USD 0,004 (saldo DataForSEO 0,799). Antes, un intento de Fabián con un token de 40 hex dio 40100 → se agregó validación del formato en cliente y servidor (commit 3332715) | Reversible desde la misma pantalla | ✔ 2026-08-24 |

## Notas operativas
- SerpBear sigue corriendo en el VPS #2 (`automation-serpbear-tawu5n-serpbear-1`) **sin cambios** hasta la validación de Fabián. Ambos actualizan a diario a las 00:00 UTC (20:00 Chile).
- Apagado de SerpBear: cambio futuro con ID propio, respaldo final de su base y OK explícito.
- Node 22 en el contenedor (Dockerfile de SerpBear). En local, Next 12 no corre en Node 26: usar `node@22` (`.node-version`).
