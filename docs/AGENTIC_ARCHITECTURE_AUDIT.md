# AGENTIC_ARCHITECTURE_AUDIT.md

**Estado:** documento de diagnóstico. No implementa nada. No modifica código.
**Alcance:** apps/operator (Electron + React), docs/CLAUDE.md, docs/DECISIONS.md, docs/CURRENT_STATE.md, docs/ROADMAP.md, docs/AGENT_ARCHITECTURE.md, docs/FUNCTIONAL_DESIGN.md, docs/TECHNICAL_FOUNDATION.md.
**Fecha del análisis:** 2026-08-11.

---

## Resumen ejecutivo

HORUS se siente manual por dos razones distintas, no una sola:

1. **Por diseño explícito.** Las reglas duras del proyecto (CLAUDE.md, DEC-004, DEC-008, DEC-041, DEC-045) prohíben que un agente publique, contacte a un negocio, envíe correo o tome decisiones de calificación sin criterio humano. Esto no es deuda técnica: es una decisión de seguridad y confianza que no debería tocarse.
2. **Por una brecha real entre lo diseñado y lo conectado.** Existe una arquitectura de agentes (`AGENT_ARCHITECTURE.md`, Fase 6) que definía tres roles — analista, compositor de concepto, compositor de outreach — pero **solo uno de los tres tiene código real**, y ese uno (`opportunity_analyst`) está formalmente desconectado del pipeline real desde DEC-099: *"un grep sobre el pipeline real... devuelve cero. El analista es un panel paralelo que el flujo del §4 del charter no toca en ningún punto."* Los otros dos roles (`concept_composer`, `outreach_composer`) nunca se implementaron como agentes: DEC-079 y DEC-081 construyeron funciones deterministas de plantilla, sin LLM, sin razonamiento, sin capacidad de decidir nada.

Es decir: la sensación de manualidad no viene solo de que "falta construir agentes". Viene de que **ya se construyó una pieza de agente real, bien acotada y probada, y luego se dejó sin cablear** por una razón de seguridad legítima y sin resolver (finding F4, prompt injection vía texto hostil de reseñas). El trabajo pendiente es mayormente de **conexión y de cerrar F4**, no de arquitectura nueva desde cero.

---

## A. Workflow actual

El flujo de 10 pasos (`FUNCTIONAL_DESIGN.md` §4, reflejado en `workflow-state.ts` y en los canales IPC de `main.ts`) es:

```
Buscar → Descubrir candidatos → Calificar y rankear → Seleccionar prospecto →
Preparar demo → Revisar/aprobar demo → Publicar → Preparar outreach →
Revisar/aprobar outreach → Handoff a Gmail → Seguimiento
```

Mecánicamente, **no existe un motor que avance el flujo**. `main.ts` registra un conjunto plano de handlers `ipcMain.handle(canal, ...)`, cada uno disparado por un botón del renderer:

| Acción | Disparador |
|---|---|
| `discovery:run` | botón "buscar" (gasta crédito SerpApi) |
| `discovery:fetch-review-history` | botón por candidato (gasta crédito) |
| `discovery:measure-web-opportunity` | botón por candidato (gasta cuota PageSpeed) |
| `prospect:set-selected` | botón "seleccionar como prospecto" |
| `publish:demonstration` | botón, detrás de un checkbox de aprobación DEC-004 |
| `outreach:open-gmail-handoff` | botón, detrás de un segundo checkbox DEC-004 |
| `outreach:declare-sent` | botón "ya lo envié" (declaración no verificada) |
| `agent:analyst:run` | botón del panel de analista (existe pero no alimenta ningún otro paso) |

No hay un objeto "Orchestrator". Cada paso es una acción aislada que el operador debe iniciar, y ninguna acción dispara automáticamente la siguiente, aunque técnicamente pudiera (por ejemplo, nada impide encadenar "buscar" → "traer reseñas" → "medir oportunidad web" para todos los candidatos económicos automáticamente; hoy cada uno requiere un clic).

## B. Puntos de intervención manual

Separando lo que **debe** seguir siendo manual (regla dura) de lo que **hoy es manual pero no tendría por qué serlo**:

**Manual por regla dura (no tocar):**
- Elegir un prospecto entre los calificados (gates G4/G5/G6 dependen de que el operador lea reseñas — DEC-008, regla dura 5).
- Aprobar la demo antes de publicar (gate DEC-004 #1).
- Aprobar el outreach antes del handoff a Gmail (gate DEC-004 #2).
- Enviar el correo (HORUS nunca tiene credencial de Gmail — DEC-041).
- Declarar enviado/no enviado (no verificable por el sistema).
- Resolver flags de juicio (sospecha de manipulación de reseñas, franquicia, riesgo reputacional — DEC-008).
- Decidir retiro/mantenimiento de una demo tras 60 días.
- Autorizar explícitamente cada prospecto real (fuera de modo sombra, por Fase 6).

**Manual hoy sin que una regla dura lo exija (candidatos a automatizar):**
- Disparar recuperación de reseñas y medición de oportunidad web candidato por candidato (ya existe un botón "Auto-screen" por lotes desde DEC-110, pero solo automatiza el scoring determinista, no la calificación — G4/G5/G6 siguen sin respuesta automática).
- Redactar el contenido de la demo: hoy es una plantilla fija (`demonstration.ts`) sin ningún razonamiento sobre qué estructura o énfasis conviene a ese negocio específico.
- Redactar el outreach: mismo caso, plantilla fija (`outreach.ts`), sin adaptar tono/ángulo a la evidencia observada.
- Revisar la demo generada en busca de errores (enlaces rotos, secciones vacías, inconsistencia con la evidencia, problemas de layout/mobile): hoy esto es 100% lectura visual del operador. Existen módulos deterministas (`obsolete-appearance.ts`, `mobile-responsiveness.ts`, `web-opportunity-audit.ts`, `freshness.ts`) pero se usan para evaluar el sitio *actual* del prospecto, no para evaluar la demo que HORUS acaba de construir.
- Verificar que la evidencia siga fresca antes de cada gate (hoy hay chequeo determinista, pero re-disparar el refresh es manual).
- Encadenar research → estrategia → estructura → contenido → construcción: hoy no existe ninguna de estas fases como concepto explícito; el "research" es simplemente los resultados crudos de SerpApi/PageSpeed, y no hay una fase de "decidir estrategia" separada de "llenar la plantilla".

## C. Capacidades reales de los agentes existentes

Solo hay **un** rol de agente con implementación: `opportunity_analyst` (`electron/agent/analyst-task.ts`, `analyst-ipc.ts`, ejecutado por `runtime.ts`).

- **Entrada:** referencias a evidencia ya retenida (`{snapshotId, source, retrievedAt}`), nunca el contenido en crudo — el agente debe pedirlo con la herramienta `read_evidence_snapshot`.
- **Herramientas realmente cableadas:** `read_evidence_snapshot` (lectura de SQLite en modo `readonly: true`, a nivel de driver) e `inspect_public_website_readonly` (GET-only, https-only, denylist de host revalidada en cada redirect, límite de tamaño en streaming). Las otras tres declaradas (`run_deterministic_scoring`, `save_agent_draft`, `request_operator_review`) están tipadas pero **no** conectadas a nada.
- **Salida:** objeto JSON estricto — `observations[]`, `proposedForReview[]`, `missingInformation[]`. `parseAnalystOutput` rechaza cualquier observación que cite un `evidenceSnapshotId` no suministrado, y rechaza cualquier campo que huela a puntaje (`score`, `rating`, `points`, `weight`, `threshold`). El agente está estructuralmente impedido de inventar un número.
- **Lo que NO existe:** `concept_composer` y `outreach_composer` son solo un tipo (`AgentRole`) declarado en `runtime.ts`; no hay ningún archivo que construya una tarea para ellos. Lo que el roadmap llama "composición de concepto y outreach" (DEC-079, DEC-081) son **funciones puras deterministas** (`buildDemonstrationSite`, `buildOutreachDraft`) que ensamblan texto de plantilla a partir de campos ya verificados — cero LLM, cero razonamiento, cero capacidad de decidir estructura o énfasis.

## D. ¿Trabajo autónomo real o wrappers sobre LLM?

El único agente real (`opportunity_analyst`) es un **wrapper acotado pero legítimo**: una sola invocación de Claude Code por tarea, con `--max-turns` que le permite hacer varias llamadas a herramientas dentro de esa tarea (lectura de evidencia, inspección de sitio) antes de devolver un JSON validado contra schema. Eso es comportamiento agentic real a nivel de una tarea — no es "mandar un prompt y parsear texto".

Lo que **no** existe en ningún punto del sistema:

- Encadenamiento entre pasos: ningún output de un agente dispara automáticamente la siguiente etapa.
- Un ciclo de autocorrección: nada evalúa el propio resultado de un agente y le pide corregirlo.
- Ejecución multi-turno entre roles: no hay traspaso de contexto de un rol a otro (no puede haberlo, porque solo un rol existe).
- Cualquier lazo BUILD → QA → FIX: no existe en absoluto, ni determinista ni agentic.

Y el agente que sí existe está, por decisión explícita (DEC-099), **fuera del camino crítico** — no por limitación técnica, sino porque el finding F4 de seguridad (inyección de prompt vía texto hostil de reseñas dirigiendo las llamadas de `inspect_public_website_readonly` a una URL atacante) sigue abierto. Ampliar autonomía sin cerrar F4 aumenta la superficie de ese riesgo exactamente en la dirección en la que se quiere avanzar (más lectura de contenido no confiable, más decisiones encadenadas).

## E. Diseño del Orchestrator

No hace falta un framework nuevo. Se propone un único módulo determinista, `electron/orchestrator/run-orchestrator.ts` (nombre ilustrativo), con estas propiedades:

- **Es código TypeScript determinista, no un LLM.** Decide *qué* tarea ejecutar a continuación y *cuándo* detenerse; nunca decide *qué dice* el contenido ni *si* una demo es publicable.
- **Vive en el proceso principal de Electron**, igual que `workflow-state.ts` y los demás IPC handlers — mismo lugar de confianza que ya tiene acceso a SQLite, evidencia y las herramientas aprobadas.
- **Máquina de estados explícita** sobre las fases nuevas (research → estrategia → estructura/contenido → build → QA → fix → entrega), reutilizando el patrón ya validado de `workflow-state.ts` (transiciones solo hacia adelante, eventos append-only, rechazo si el estado propuesto no es aceptable) en vez de inventar uno nuevo.
- **Se detiene solo en:** (a) los dos gates DEC-004, (b) cualquier flag de juicio G4/G5/G6, (c) agotar el máximo de iteraciones del lazo FIX, (d) un fallo de agente no recuperable. En todo lo demás, avanza sin esperar un clic.
- **No sustituye nada de lo que ya es determinista** (scoring, freshness, aprobación, publicación, Gmail) — solo automatiza la secuencia de *disparar* esos pasos y de invocar tareas de agente acotadas entre ellos.

## F. Diseño de estado/contexto compartido

Reutilizar la infraestructura existente en vez de crear una nueva:

- El **snapshot de evidencia inmutable** (SQLite + archivos JSON direccionados por contenido) ya es el mecanismo correcto de contexto compartido — cada agente ya recibe *referencias*, nunca contenido inlineado, y ya se citan por id. Extender este mismo patrón a las fases nuevas en vez de inventar otro formato de contexto.
- Añadir una tabla/store de **"artefactos de construcción"** (borrador de sitio, reporte de QA, iteración de fix) con la misma disciplina que ya rige la evidencia: append-only, cada artefacto referencia los artefactos/evidencia de los que depende, nunca se sobreescribe — una nueva versión es un nuevo registro.
- Un **"run context"** ligero (un id de ejecución) que agrupa punteros: `businessInput`, `evidenceSnapshotIds[]`, `strategyArtifactId`, `contentArtifactId`, `buildArtifactId`, `qaReportIds[]`. Los agentes reciben ese contexto por referencia, igual que el analista hoy recibe `EvidenceReference[]` y no el contenido crudo.
- La conversación con Claude Code **no es memoria autoritativa** (ya es un principio en `AGENT_ARCHITECTURE.md` §3) — se mantiene: cada tarea es stateless entre sí, el estado vive en SQLite.

## G. Contratos de entrada/salida por agente

Mismo patrón que `opportunity_analyst`, extendido a los roles nuevos:

| Rol | Input | Output (schema estricto) | Restricción de validación |
|---|---|---|---|
| `opportunity_analyst` (ya existe) | referencias de evidencia | `observations[]`, `proposedForReview[]`, `missingInformation[]` | prohíbe citar evidencia no suministrada; prohíbe campos que parezcan puntajes |
| `strategy_composer` (nuevo) | evidencia + observaciones del analista | ángulo de posicionamiento, secciones a incluir/omitir, justificación por evidencia | cada elección de sección debe citar una observación o evidencia; nunca inventa un servicio no verificado |
| `concept_composer` (rol ya tipado, sin implementar — implementarlo) | estrategia + evidencia verificada | copy estructurado por sección (título, texto, cita de imagen si existe) — **no HTML, no código libre** | cada frase con contenido específico del negocio debe mapear a un id de evidencia (mismo principio que hoy exige `ProspectRecord`/evidence inventory a mano) |
| `qa_critic` (nuevo) | artefacto de build + evidencia + checklist determinista | `findings[]` con severidad, tipo (`broken_link`, `unsupported_claim`, `layout`, `missing_section`, `stale_data`), y referencia al elemento afectado | no puede aprobar publicación (eso sigue siendo el gate DEC-004); solo produce hallazgos |
| `fix_composer` (nuevo, o reutiliza `concept_composer` en modo "revisar") | artefacto anterior + findings de QA | mismo schema que `concept_composer`, con un campo `resolvedFindingIds[]` | igual restricción de evidencia; no puede introducir contenido nuevo no pedido por un finding |

El compositor de outreach (`outreach_composer`) puede quedarse como está (plantilla determinista) — no hay evidencia de que la calidad del outreach sea hoy un problema, y tocar el contacto con el negocio es la parte más sensible del sistema (ver sección J).

## H. Ciclo autónomo BUILD → QA → FIX → QA

```
1. BUILD   — concept_composer produce contenido estructurado (con evidencia citada)
              → demonstration.ts (determinista, sin tocar) lo renderiza a HTML/plantilla
2. QA      — capa determinista primero: freshness.ts, mobile-responsiveness.ts,
              obsolete-appearance.ts, web-opportunity-audit.ts corridos contra el
              artefacto recién construido (mismo código que hoy evalúa el sitio del
              prospecto, apuntado a la demo propia)
              → capa de juicio: qa_critic revisa lo que lo determinista no puede
              (coherencia del copy, si una sección se siente vacía, tono)
3. ¿Findings bloqueantes?
     No  → detener el lazo, estado = awaiting_operator_review
     Sí  → FIX: fix_composer resuelve los findings citados → volver a BUILD
4. Tope duro de iteraciones (ej. 3). Si se agota sin limpiar los findings
   bloqueantes, el lazo se detiene igual, marca los findings restantes como
   "no resueltos automáticamente" y pasa a revisión del operador — nunca
   se fuerza una aprobación ni se publica por agotamiento del lazo.
```

Ningún paso de este lazo toca `publish:demonstration` ni ningún canal de outreach. El lazo entero ocurre **antes** del primer gate DEC-004. Esto es importante: el ciclo BUILD→QA→FIX es autónomo precisamente porque publicar no lo es — nada se pierde en seguridad al automatizar esta parte.

## I. Lazo de QA y autocorrección — detalle de las restricciones

- **QA determinista antes que QA por juicio**, siempre, en ese orden — es más barato, más confiable y no depende de disponibilidad de Claude Code. Un finding determinista (enlace roto, dato con más de 30 días, sección sin cobertura de evidencia) nunca necesita opinión de un LLM.
- **El critic nunca inventa el estándar de "listo".** El checklist de publicación ya existe en `FUNCTIONAL_DESIGN.md` §6.4 (cobertura de fuente, aviso de concepto visible, noindex, formulario deshabilitado o etiquetado, freshness de 30 días, URL real, capacidad de remoción) — el `qa_critic` se limita a verificar contra ese checklist ya aprobado, no a proponer uno nuevo.
- **Todo finding y todo fix quedan en el mismo append-only log de eventos** que ya usa el resto del sistema (`store.appendEvent`) — el operador, al llegar a `awaiting_operator_review`, ve el historial completo de iteraciones, no solo el resultado final.
- **El lazo puede fallar de forma segura.** Reutilizar exactamente la clasificación de fallos que ya existe en `runtime.ts` (`classifyFailure`) y la garantía ya probada en DEC-100 (una ejecución fallida nunca persiste output parcial ni llama `saveDraft`) — un fallo del `fix_composer` a mitad de lazo debe dejar el último artefacto bueno intacto, nunca un estado a medio corromper.

## J. Puntos de intervención humana (no negociables)

Idénticos a los de la sección B, "manual por regla dura", repetidos aquí como la lista que el Orchestrator debe respetar sin excepción:

1. Selección del prospecto entre calificados.
2. Aprobación de la demo (gate DEC-004 #1) — **incluye** revisar el resultado final del lazo BUILD→QA→FIX, no solo un primer borrador.
3. Aprobación del outreach (gate DEC-004 #2).
4. Envío del correo (fuera del sistema, en Gmail, por el operador).
5. Declaración de enviado/no enviado.
6. Resolución de cualquier flag de juicio (G4/G5/G6, DEC-008).
7. Decisión de retiro/mantenimiento de demo a 60 días.
8. Autorización explícita para operar fuera de modo sombra sobre un prospecto real (mientras F4 siga abierto, esto debería seguir siendo obligatorio incluso para la parte de research/build, no solo para publish/outreach).

Nada de lo propuesto en E–I mueve ninguno de estos ocho puntos. El operador pasa de "operar cada paso" a "revisar el resultado ya construido, QA'd y corregido una vez" — supervisor, no operador, tal como se pidió, pero sin tocar ninguna de las reglas duras de CLAUDE.md.

## K. Plan mínimo de implementación

Sin sobreingeniería — orden por menor esfuerzo y mayor reducción de trabajo manual primero:

1. **Cerrar o aceptar formalmente el finding F4** (SECURITY_REVIEW.md). Es el bloqueante real de DEC-099 para reconectar cualquier agente al camino crítico. Sin esto, ampliar autonomía es repetir el mismo riesgo que ya se decidió no aceptar todavía. Este paso no es opcional en el plan — es el prerequisito de todo lo demás.
2. **Reconectar `opportunity_analyst` al flujo de selección de candidatos**, tal como ya estaba previsto en DEC-110 pero deferido por F4. Esto ya reduce carga manual real (lectura de evidencia cruda) sin escribir un solo agente nuevo.
3. **Construir el Orchestrator determinista** (sección E) como un módulo nuevo y pequeño que simplemente encadena los IPC handlers *ya existentes* de discovery/scoring en lote (extendiendo lo que DEC-110 ya empezó con "Auto-screen"), sin tocar su lógica interna.
4. **Implementar `concept_composer` como agente real**, usando exactamente el mismo `runtime.ts`/`analyst-task.ts` que ya existe y ya está probado (DEC-100) — es agregar un `buildConceptTask()` análogo a `buildAnalystTask()`, con su propio schema y su propia validación de evidencia, no una infraestructura nueva. `demonstration.ts` se queda como el renderizador determinista final.
5. **Implementar `qa_critic`** apoyado primero en el código determinista que ya existe (`freshness.ts`, `mobile-responsiveness.ts`, `obsolete-appearance.ts`, `web-opportunity-audit.ts`), reapuntado a la demo propia en vez del sitio del prospecto — esto es la mayor parte del valor de QA con cero LLM. Agregar la capa de juicio (`qa_critic` como agente) solo si, tras usar la capa determinista, sigue habiendo una categoría de error que un humano detecta y el código no.
6. **Implementar `fix_composer`** reutilizando el mismo mecanismo que `concept_composer`, en modo "revisar contra findings".
7. **Cablear el lazo BUILD→QA→FIX dentro del Orchestrator**, con tope de iteraciones y sin tocar ningún canal de publish/outreach.

**Qué NO tocar, porque ya funciona y es la parte más frágil de auditar de nuevo:**

- El modelo de scoring (`reputation-scoring-v1`, `web-opportunity-v2`) y su versionado — DEC-086/DEC-087 ya probaron reproducibilidad exacta contra evidencia retenida.
- La capa de evidencia/provenance (SQLite readonly, snapshots inmutables direccionados por contenido).
- `workflow-state.ts` y sus invariantes de transición (solo-adelante, eventos append-only, aprobaciones irrevocables salvo por DEC-101).
- El mecanismo de compose-handoff a Gmail (DEC-041) y la ausencia total de credencial de envío.
- Los gates DEC-004 tal como están, incluida su re-invalidación ante edición (DEC-101).
- El allowlist de herramientas del agente y `FORBIDDEN_TOOL_PATTERNS` en `runtime.ts` — es la barrera de seguridad más importante del sistema y ya está bien acotada.
- `evidence-mcp-server.ts` / `website-inspector.ts` tal como están (solo lectura, https-only, denylist por hop) — extender esto para nuevos roles, no reescribirlo.

---

### Nota final

El hallazgo más importante de esta auditoría no es "faltan agentes": es que **ya existe una pieza de agente real, probada (465 tests, DEC-100), acotada por diseño y con las validaciones correctas**, y hoy no participa en ningún prospecto real por una decisión de seguridad explícita y sin resolver. El camino más corto hacia "yo superviso, el sistema opera" no es construir una arquitectura nueva — es cerrar F4, reconectar lo que ya se construyó, y extender el mismo patrón (tarea acotada → schema estricto → validación de evidencia) a dos o tres roles nuevos, sin tocar ninguna de las ocho reglas de intervención humana de la sección J.
