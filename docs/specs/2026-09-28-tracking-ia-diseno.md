# Tracking IA — diseño

**Fecha:** 2026-09-28 · **Estado:** aprobado por Fabián, pendiente de plan de implementación

Pestaña nueva en PoloRank que muestra, para las mismas keywords que ya se siguen, **si el dominio
aparece citado en el resumen con IA de Google**.

---

## El hallazgo que lo hace posible

El resumen con IA (`ai_overview`) **ya viene completo en la consulta de SERP que PoloRank paga hoy**.
Verificado el 2026-09-28 con una consulta real a `madera de roble` (Chile, es, depth 10):

```
costo:                    USD 0,002   ← el mismo de siempre
asynchronous_ai_overview: false       ← no requiere expansión aparte ni parámetro extra
markdown:                 texto completo de la respuesta de Google
references:               fuentes citadas, con source · domain · url · title · text
```

Hoy `scrapers/services/dataforseo.ts` mapea `ai_overview` únicamente como **nombre de feature**
(`FEATURE_MAP`, línea 29). El contenido y las referencias se descartan: de los 27 KB que devuelve una
consulta, PoloRank guarda 1,4 KB (5%).

**Costo operativo de esta funcionalidad: cero.** No hay endpoint nuevo ni parámetro que cobre.

### Por qué vale la pena

Medido sobre 1.658 registros diarios reales (31 días, 59 keywords), el resumen con IA aparece en el
**52,5% de las SERPs** de la cartera — más seguido que el mapa local (35,3%):

| Dominio | SERPs con resumen IA |
|---|---|
| thetravellab.com.br | 86,7% |
| emignia.com | 68,3% |
| maderasfresard.com | 67,8% |
| mavae.cl | 48,3% |
| fiori.cl | 30,6% |
| goaraucania.cl | 6,5% |
| ammo.cl | 4,6% |

Y **ser citado no es lo mismo que posicionar**. En `madera de roble`, de las 6 fuentes citadas solo 3
están en el top orgánico; YouTube, TikTok y un sitio español aparecen citados sin posicionar. El
1º orgánico (Tranapuente) comparte la respuesta con un video de TikTok. Es una métrica distinta de la
posición, y hoy no se mide.

---

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| D1 | Pestaña nueva **a la derecha de Tracking**; Tracking sigue siendo la principal | Es una vista informativa del mismo conjunto de keywords |
| D2 | **Espejo de Tracking**: mismas keywords, mismo orden, mismos filtros | Comparabilidad directa entre las dos pestañas |
| D3 | **Solo lectura.** No se agregan ni editan keywords desde acá | Alta y edición siguen viviendo en Tracking, sin duplicar caminos |
| D4 | Extender **`keyword_daily`**, no crear tabla aparte | Ya es "una fila = el contexto de un día"; la cita es parte de ese contexto |
| D5 | **Sin datos hacia atrás.** La pestaña arranca vacía y se llena hacia adelante | Las referencias nunca se guardaron; no son recuperables. Mismo criterio que el registro diario en agosto |
| D6 | **Tres estados**, no dos: citado · no citado · sin resumen | "No hay resumen" no es "no te citan". Misma disciplina que `na` vs `fail` en la auditoría |
| D7 | Los períodos muestran **`citado/oportunidades`**, no una flecha de cambio | No hay magnitud que medir, y el resumen no aparece todos los días: sin el segundo número el primero engaña |
| D8 | **No** se incluye la posición orgánica en la tabla | Sería el mismo número que ya muestra Tracking. Sí aparece en el panel de detalle, donde se está mirando una keyword concreta |
| D9 | **No** se incluye el conteo de fuentes | Descartado en el diseño: no cambia ninguna decisión y es ruidoso sobre 5-6 elementos. El detalle vive en el panel |

---

## Modelo de datos

Dos columnas nuevas en `keyword_daily`:

Tres columnas nuevas en `keyword_daily`:

| Columna | Tipo | Contenido |
|---|---|---|
| `ai_cited` | INTEGER | `1` citado · `0` no citado · `-1` no hubo resumen con IA ese día |
| `ai_references` | TEXT | JSON con las fuentes: `[{position, source, domain, url, title}]` |
| `ai_text` | TEXT | El texto del resumen, para el panel de detalle |

`ai_cited = -1` es el tercer estado de D6 y es lo que permite que el denominador de D7 cuente
**oportunidades** (días con resumen) y no días calendario.

`ai_text` se guarda día a día como el resto del contexto: son 1-3 KB por fila y solo en los días con
resumen, unos 35 MB al año para la cartera actual. Guardarlo evita un caso especial en el panel y
deja abierta una pregunta que hoy nadie puede responder: **¿cambia con el tiempo lo que Google dice
sobre este tema?**

Migración que solo agrega columnas, sin alterar nada existente — mismo patrón que
`1787600000004-create-keyword-daily`.

---

## Captura

`scrapers/services/dataforseo.ts` gana un extractor nuevo, hermano de `featuresExtractor`, que del
bloque `ai_overview` devuelve las referencias normalizadas. `utils/refresh.ts` las guarda en la fila
diaria junto al resto del contexto.

Reglas:

- **Citado** = alguna referencia cuyo dominio coincide con el dominio seguido, comparando sin `www`
  y sin distinguir mayúsculas. Es el mismo criterio de coincidencia que usa `arq.target.reachable`.
- Si el bloque `ai_overview` **no está** en la respuesta → `ai_cited = -1`.
- Si el bloque está pero viene con `asynchronous_ai_overview: true` y sin referencias → `ai_cited = -1`
  y se registra el motivo. **Nunca se interpreta como "no te citan"**: no se pudo medir.
- Un fallo leyendo las referencias no puede romper la actualización de posición: se captura y se sigue.

---

## Pantalla principal

```
 Tracking  ·  Tracking IA  ·  Discover  ·  Insight  ·  Ideas
 ─────────────────────────────────────────────────────────────────────────────────────

 Keyword               Vol.   ¿Te cita?  Puesto   URL citada      7d     30d     60d   90d
 ──────────────────────────────────────────────────────────────────────────────────────────
 madera de roble       720      ✗ No       —         —           0/6    0/21    0/44   —
 madera de raulí       320      ✓ Sí       2      /producto/…    5/6   18/22   39/45   —
 maderas del sur       590      — N/A      —         —            —      —       —     —
 madera de coihue      170      ✓ Sí       4      /producto/…    6/6   20/20   41/43   —
```

| Columna | Qué muestra |
|---|---|
| **Keyword** | Igual que Tracking: bandera, nombre, etiquetas |
| **Vol.** | Volumen de Google. Se mantiene para poder priorizar |
| **¿Te cita?** | `✓ Sí` · `✗ No` · `— N/A` (no hubo resumen) |
| **Puesto** | Lugar del dominio entre las fuentes citadas |
| **URL citada** | Qué página propia citó la IA |
| **7d · 30d · 60d · 90d** | `citado/oportunidades` — ej. `18/22` = hubo resumen 22 veces y te citaron en 18 |

`90d` permanece en `—` hasta que haya 90 días de datos (noviembre de 2026).

---

## Panel de detalle

Se abre al hacer clic en una fila, igual que hoy se abre el panel con la SERP completa.

```
 madera de roble                                        720 búsquedas/mes
 ─────────────────────────────────────────────────────────────────────────

 LO QUE RESPONDE GOOGLE
 "La madera de roble es un material duro, pesado y muy resistente que se
  destaca por su durabilidad y sus vetas pronunciadas…"

 QUIÉN ESTÁ CITADO                            tu posición orgánica: fuera de 50
 ─────────────────────────────────────────────────────────────────────────
 1  Sodimac                    sodimac.cl                      · 2º orgánico
 2  MADERAS TRANAPUENTE        maderastranapuente.cl           · 1º orgánico
 3  Maderas Nativas de Chile   maderanativachile.cl            · 4º orgánico
 4  YouTube                    youtube.com                     · no está
 5  TikTok                     tiktok.com                      · no está
 6  Maderame                   maderame.com                    · no está

 ⚠  maderasfresard.com no aparece entre las fuentes
```

La columna de la derecha cruza cada fuente citada contra el top orgánico de esa misma búsqueda, que
ya está guardado en `keyword_daily.serp_top`. Costo cero, y es lo que revela que Google cita cosas que
no están posicionadas.

---

## Fuera de alcance

- **Backfill.** No existe y no se puede reconstruir.
- **ChatGPT, Claude, Perplexity.** Verificado el 2026-09-28: la base de menciones de DataForSEO
  para Chile y Brasil cubre **únicamente `google`**; `chat_gpt` solo existe en Estados Unidos/inglés.
  Medirlos exigiría preguntarles uno por uno, pagando cada pregunta, sin denominador por plataforma.
- **Volumen de búsqueda en IA.** Existe (`ai_optimization/ai_keyword_data`, USD 0,00027 por keyword en
  lote) pero es otro endpoint. Medido el 2026-09-28: el volumen IA es el **0,36%** del de Google en la
  cartera, salvo en las keywords de maderas (5-19%). Queda anotado como posible columna futura.
- **Alertas.** Nada de notificaciones en esta entrega.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El resumen con IA aparece y desaparece día a día | Por eso el denominador son oportunidades y no días. Un solo día sin cita no significa nada |
| DataForSEO cambia la forma del bloque `ai_overview` | El extractor tolera campos ausentes y marca `-1` en vez de asumir "no citado" |
| La captura corre dentro del flujo de actualización de posiciones | Va envuelta en su propio manejo de errores, igual que `recordDailySnapshot`. Un fallo no puede tumbar el scrape |
| Pantalla vacía en Ammo y GoAraucania (5% de resúmenes) | Es el dato real, y se muestra como `N/A` explícito. Dice algo verdadero: a esos clientes Google todavía no les responde con IA |

## Costo

**USD 0,00 de operación.** Los datos vienen en el scrape actual. El espacio adicional es de unos pocos
MB al año, contra 23 GB libres en el VPS.
