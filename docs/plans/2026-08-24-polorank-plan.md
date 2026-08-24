# PoloRank — Plan de implementación

**Fecha:** 2026-08-24 · **Spec aprobado:** `docs/specs/2026-08-24-polorank-design.md`
**Orden:** M1 → M2 → M5 → M3 → M4 → M7 → M6. Cada módulo se entrega y se revisa antes del siguiente.
**Regla:** los pasos marcados 🔐 tocan servicios reales (GitHub, VPS, DataForSEO, DNS) y se ejecutan solo con OK explícito de Fabián.

---

## Estado de infraestructura verificado el 2026-08-24 (lectura, sin cambios)

| VPS | RAM total | Disponible ahora | Swap | Notas |
|---|---|---|---|---|
| #2 automation (`178.105.255.184`) | 7,75 GB | **3,1 GB** | 4 GB | SerpBear usa 165 MiB. `System/SSH-SERVERS.md` dice 3,7 GB — está desactualizado (el VPS creció). |
| #1 web Hetzner (`91.99.66.186`) | 3,8 GB | 2,0 GB | 2 GB | emignia-web + ammo-dress-web + Dokploy (714 MiB). |

**Decisión de hosting (D12, 2026-08-24):** **VPS #1 web** (Dokploy enfocado en apps web). Impacto: PoloRank pesará ~170 MiB (igual que SerpBear) → **margen restante ~1,8 GB + 2 GB swap** junto a emignia.com y MyDress. SerpBear sigue en el VPS #2: contenedor `automation-serpbear-tawu5n-serpbear-1`, base en volumen `automation-serpbear-tawu5n_serpbear_data` → `/app/data`.

---

## M1 — Base (sin servicios reales salvo GitHub y copia de lectura del VPS)

1. **Fork del repo** 🔐 — `gh repo fork towfiqi/serpbear --clone=false --fork-name polorank` en la cuenta `afiorideo`; clonar en `Laboratorio/polo-rank/polorank/`. Rama de trabajo `main` (repo personal, sin PRs, push confirmado por Fabián — misma regla que emignia-web).
2. **Renombrar el paquete** — `package.json` (`name: polorank`, `version: 0.1.0`), `README.md` con créditos a SerpBear (MIT) y descripción de PoloRank. Copiar `docs/specs` y `docs/plans` dentro del repo.
3. **Entorno local** — `npm install`, `.env` local (SECRET, APIKEY, SESSION_DURATION=720, NEXT_PUBLIC_APP_URL=http://localhost:3000, ADMIN_EMAIL, SMTP_* de pruebas). Verificar `npm run dev` levanta y `npm test` pasa en verde **antes de tocar nada** (línea base).
4. **Copia de la base actual** 🔐 (solo lectura en el VPS) — `ssh` + `docker cp` del `serpbear.sqlite` del contenedor a `polorank/data/serpbear-copia-2026-08-24.sqlite` (queda fuera de git). Verificar con `sqlite3`: cantidad de dominios (4) y keywords, y que el `history` tiene datos.
5. **Pipeline de migraciones** — probar `npx sequelize-cli db:migrate` sobre la copia; confirmar que las migraciones existentes son idempotentes y que el `entrypoint.sh` las corre al arrancar.
6. **Apagar todo al cerrar** — verificar con `ps` que no queda `next dev` corriendo.

**Entrega M1:** PoloRank corre en local con tus datos reales (copia), pruebas en verde, primer commit y push 🔐.

---

## M2 — Conector DataForSEO

1. **Extender el marco de scrapers** — `types.d.ts`: `method?`, `body?()`, `depthBased?` en `ScraperSettings`. `utils/scraper.ts`: `scrapeSinglePage` respeta `method`/`body`; `scrapeKeywordWithStrategy` agrega el camino `depthBased` (resuelve estrategia global/dominio → calcula `depth` → 1 llamada con `pagination = {start:0, num: depth}`; full fallback = 2ª llamada a 100 si no encontró el dominio). Función pura `strategyToDepth(strategy, paginationLimit, lastPosition)` en `utils/scraper.ts`, con pruebas.
2. **Códigos de país/idioma** — ampliar `utils/countries.ts` con `location_code` y `language_code` de DataForSEO para todos los países que SerpBear lista (tabla oficial de DataForSEO; se descarga una vez con la API `serp/google/locations`, gratis).
3. **Scraper** `scrapers/services/dataforseo.ts` — Basic auth desde `settings.scaping_api` (`login:password`), body JSON (keyword, location_code / location_name si hay ciudad, language_code, device, os, depth), extractor de `items` tipo `organic` → `{position: rank_absolute, url, title}`, y lista normalizada de features (`featured_snippet`, `people_also_ask`, `local_pack`, `video`, `images`, `shopping`, `ai_overview`, `knowledge_graph`). Registrar en `scrapers/index.ts` y en las opciones de Configuración → Scraper (label "DataForSEO", allowsCity).
4. **Persistencia** — migración `add-keyword-serp-features` (columna `serp_features` JSON `[]`) y migración `create-api-usage` (tabla §5.1 del spec). Modelo `ApiUsage`. `utils/usage.ts → logUsage()` llamado desde el flujo de refresh con dominio, keyword, depth, `cost` de la respuesta, `triggered_by` (`cron` o `user.ID`) y `status`.
5. **Errores** — mapear `status_code` ≠ 20000 y errores de task a `lastUpdateError`; detectar saldo agotado (40201/40202) y dejar un aviso en `settings` que Configuración muestra.
6. **Pruebas** — fixture con una respuesta real de DataForSEO (guardada del primer test), pruebas del extractor, de `strategyToDepth` y del registro de uso.
7. **Primer test real** 🔐 — configurar credenciales de `Seo-Admin-Central/seo-credentials.yaml` en la app local, refrescar **2 keywords** (≈ USD 0,004–0,02). **Radiografía de entrada:** guardar y revisar el body enviado y la respuesta cruda. Informar costo a Fabián.

**Entrega M2:** posiciones de 2 keywords reales actualizadas vía DataForSEO en local, features guardadas, costo registrado en `api_usage`.

---

## M5 — Acceso y usuarios

1. **Migraciones + modelos** — `user`, `login_code` (spec §5.1). Siembra del superadmin desde `ADMIN_EMAIL` al arrancar (en `database/database.ts` tras `sync`/migrate).
2. **Correo** — `utils/auth/mailer.ts` con `nodemailer` y las variables `SMTP_*`; plantilla del código en `email/` (texto plano + HTML simple con logo).
3. **Endpoints** — `POST /api/auth/request` (genera código, hash, límite 5/hora, respuesta neutra), `POST /api/auth/verify` (valida, intentos ≤ 5, marca usado, emite JWT `{uid,email,role,domainId}` en cookie httpOnly), `POST /api/logout` (existente, ajustado). Eliminar `pages/api/login.ts` con USER/PASSWORD.
4. **Guardas** — `utils/verifyUser.ts` devuelve `{ authorized, user }`; nuevas `requireRole(user, roles[])` y `requireDomainAccess(user, domainOrSlug)`. Aplicar en **todos** los handlers de `pages/api/*` según la matriz §6.2 (refresh solo superadmin; keyword add/delete superadmin o domain_admin del dominio; domains/settings/users/usage solo superadmin; lecturas filtradas al dominio del usuario).
5. **Páginas** — `getServerSideProps` en `pages/index.tsx`, `pages/domain/*`, `pages/settings*`: sin sesión → `/login`; usuario de dominio → redirigir a `/domain/<slug>` y bloquear Configuración. Barra lateral: solo dominios permitidos; botones ocultos según rol.
6. **Pantalla Usuarios** — `components/settings/Users.tsx` + `pages/api/users.ts` y `users/[id].ts` (listar, crear, editar rol/dominio, activar/desactivar, eliminar; el superadmin sembrado es intocable). Selector de dominio obligatorio y único para roles de dominio.
7. **Login** — `pages/login.tsx` en dos pasos (correo → código), textos en español de Chile, mensajes de error claros.
8. **Pruebas** — guardas por rol (domain_admin no lee otro dominio ni llama a refresh; domain_user no agrega keywords; sin sesión nada), flujo request/verify con código vencido, reintentos y reenvío.

**Entrega M5:** entras con tu correo y código en local; creas un usuario de prueba de dominio y compruebas que solo ve lo suyo.

---

## M3 — Tracking

1. **Cálculos puros** — `utils/history.ts`: `positionAt(history, daysAgo)` (±3 días de tolerancia), `deltas(history)` → {7,30,60,90}, `bestPosition(history)`, `monthlySummary(history, urlHistory?)` → [{mes, mejor, promedio, peor, cambio}], `trend(history, compareDays)` → subiendo/bajando/igual. Pruebas con un `history` de ejemplo de 120 días.
2. **API** — `/api/keywords` ya devuelve `history`; agregar `serp_features` y `depth` de la última consulta (para mostrar "+N"). Sin endpoints nuevos. **Nota (test real M2):** con `depth` 20 DataForSEO devuelve 20 bloques de SERP y ~18 orgánicos; el "+N" se calcula sobre los orgánicos realmente recibidos (`lastResult` sin `skipped`), no sobre el `depth` pedido.
3. **Tabla** — rediseñar `components/keywords/KeywordsTable.tsx` y `Keyword.tsx` con las columnas de la opción B (§8.1), semáforo, "+N", iconos de snippets, columnas GSC condicionadas a Search Console conectado. Mantener orden por columna, selección múltiple, tags y exportar.
4. **Filtros** — `KeywordFilter.tsx`: Todas/Subiendo/Bajando, Todas/Top 10/Top 20, "Comparar con" (7/30/60/90) que gobierna la flecha de Posición. Persistir la selección en la URL (`?trend=up&top=10&cmp=30`) para que un enlace conserve la vista.
5. **Panel lateral** — rediseñar `KeywordDetails.tsx` (§8.3): rango, 4 indicadores, gráfico con eje invertido (reusar `Chart.tsx`), tabla mensual, top resultados. Navegación anterior/siguiente sin cerrar el panel.
6. **QA** — revisar con datos reales de la copia (ammo, goaraucania, mavae, emignia) en desktop y móvil; comprobar que las columnas 30/60/90 muestran "—" cuando no hay historial suficiente.

**Entrega M3:** vista Tracking igual a la maqueta B con tus datos reales, panel lateral igual a la maqueta A.

---

## M4 — Marca y temas

1. **Activos** — `public/brand/` (cara transparente en 512/192/32 px, favicon `.ico` + `.png`, `apple-touch-icon`), wordmark como componente `Logo.tsx` (imagen + texto con gradiente).
2. **Tokens** — `tailwind.config.js` con la paleta §9 (claro/oscuro) y `darkMode: 'class'`; fuentes Inter + Space Grotesk en `_document.tsx`.
3. **Tema** — `components/common/ThemeToggle.tsx` (sol/luna en la barra lateral), preferencia en `localStorage`, default `prefers-color-scheme`, script inline anti-parpadeo en `_document.tsx`.
4. **Aplicar** — recorrer componentes (`Sidebar`, `TopBar`, `Modal`, `SidePanel`, `InputField`, `SelectField`, tablas, Configuración, login) reemplazando la paleta de SerpBear por los tokens, con variantes `dark:`.
5. **Renombrado** — "SerpBear" → "PoloRank" en interfaz, `email/` (plantillas de notificación), títulos, `package.json`, README (créditos a SerpBear se mantienen). Pie de página: "PoloRank · basado en SerpBear".
6. **QA visual** — ambos temas, desktop y móvil, contraste WCAG AA en textos secundarios (verificar con los valores del playbook: `#7B85A0` mínimo sobre `#080812`).

**Entrega M4:** capturas de las pantallas principales en claro y oscuro para tu revisión.

---

## M7 — Panel de consumo

1. **Agregados** — `utils/usage.ts → summarize(from, to)`: totales, por dominio, por usuario (dominio del usuario + refrescos manuales originados), proyección a fin de mes. Pruebas con registros de ejemplo.
2. **Saldo DataForSEO** — `GET /v3/appendix/user_data` (gratis) al abrir la pantalla, con las credenciales guardadas; si falla, mostrar "no disponible" sin romper la pantalla.
3. **Endpoint** — `GET /api/usage?from&to` (solo superadmin) + `?format=csv`.
4. **Pantalla** — `components/settings/Usage.tsx`: filtro de período, 3 cuadros (§10), exportar CSV.

**Entrega M7:** Configuración → Consumo con datos reales de las pruebas de M2.

---

## M6 — Producción

1. **Dokploy** 🔐 — crear app `polorank` en el Dokploy del **VPS #1** (`91.99.66.186`) desde el repo GitHub (build Dockerfile), variables de entorno de producción (SMTP Zoho `hola@emignia.com`, `ADMIN_EMAIL`, `SECRET`/`APIKEY` nuevos, `SESSION_DURATION=720`, `NEXT_PUBLIC_APP_URL`), volumen `polorank_data` → `/app/data`, límite de memoria del contenedor 512 MiB. Ficha de cambio con ID `POLO-2026-MM-DD-01`, respaldo = no aplica (app nueva), margen restante del sistema informado.
2. **DNS** 🔐 — registro `polorank.emignia.com` en Cloudflare → IP del **VPS #1** (`91.99.66.186`, proxy activado), dominio en Dokploy con SSL.
3. **Migración real** 🔐 — copia fresca del `serpbear.sqlite` del volumen de SerpBear (VPS #2) → local → `scp` al VPS #1 → volumen de PoloRank como `polorank.sqlite`; el `entrypoint.sh` corre las migraciones al arrancar; siembra del superadmin. Respaldo de la copia en `Laboratorio/polo-rank/backups/` (fuera de git).
4. **Configuración inicial** 🔐 — entrar con tu correo, cargar credenciales DataForSEO en Configuración → Scraper, estrategia global (la misma que tienes hoy en SerpBear), refresco manual de prueba de 2–3 keywords, revisar Consumo.
5. **Validación de Fabián** — checklist: login, tracking de los 4 dominios, panel lateral, tema claro/oscuro, usuario de dominio de prueba, cron diario corrió al día siguiente, consumo registrado.
6. **Apagado de SerpBear** 🔐 — cambio con ID propio: respaldo final de su base, detener la app en Dokploy (no borrar por 30 días), registrar en el registro de cambios del proyecto.
7. **Documentación** — actualizar `CONTEXTO-ACTUAL.md` (Laboratorio → PoloRank en producción), `System/SSH-SERVERS.md` (RAM real del VPS #2; app polorank en el VPS #1), playbook Emignia (excepción Next 12) y memoria del proyecto.

---

## Registro de cambios del proyecto

Se lleva en `docs/REGISTRO-DE-CAMBIOS.md` dentro del repo a partir del primer despliegue (M6). En desarrollo local (M1–M7) el registro es el historial de commits.
