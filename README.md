# PoloRank

Tracking de posiciones SEO de Emignia — `polorank.emignia.com`.

PoloRank es un fork de [SerpBear](https://github.com/towfiqi/serpbear) (MIT, © Towfiq I.) con estos cambios:

- **Conector DataForSEO** (modo live) con registro de costo por consulta.
- **Vista Tracking estilo DinoRank**: cambios a 30/60/90 días, evolución, snippets de la SERP, URL posicionada, filtros subiendo/bajando y Top 10/20, panel lateral con historial mensual.
- **Marca PoloRank** con paleta Emignia, tema claro y oscuro.
- **Acceso por código al correo** (sin contraseña) con tres roles: superadmin, administrador de dominio y usuario de dominio (un dominio por usuario).
- **Panel de consumo** de la API por dominio y por usuario.

Todo lo demás de SerpBear se conserva: cron diario, notificaciones, Search Console, Ideas (Google Ads), tags, exportar CSV.

## Documentación

- Diseño aprobado: [`docs/specs/2026-08-24-polorank-design.md`](docs/specs/2026-08-24-polorank-design.md)
- Plan de implementación: [`docs/plans/2026-08-24-polorank-plan.md`](docs/plans/2026-08-24-polorank-plan.md)

## Desarrollo local

```bash
npm install
cp .env.example .env   # y completar valores
npm run dev            # http://localhost:3000
npx jest --ci          # pruebas
```

La base SQLite vive en `data/database.sqlite` (carpeta excluida de git). Las migraciones corren con `npx sequelize-cli db:migrate --env production` (el `entrypoint.sh` del contenedor las ejecuta al arrancar).

## Stack

Next.js 12 (Pages Router) · React 18 · TypeScript · Tailwind 3 · SQLite + Sequelize · croner · nodemailer · Jest. Se mantiene el stack de SerpBear a propósito (ver decisión D1 del spec).

## Créditos

Basado en SerpBear, de Towfiq I., licencia MIT. El archivo `LICENSE` original se conserva.
