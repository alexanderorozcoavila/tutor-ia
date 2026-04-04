# TD: Arquitectura de Tareas en Jornadas — Estado y Tareas Pendientes

## Resumen

Estado general de la implementación del TD `TD_arquitectura_tareas_jornadas.md`. Se auditaron migraciones SQL, servicios, hooks, y componentes.

---

## ✅ LO QUE YA ESTÁ IMPLEMENTADO

### § 1 — Aislamiento del Kiosco (agent.py)
- ✅ `lanzar_recompensa()` usa `--user-data-dir=/tmp/tutor_reward_isolated_session`
- ✅ `cerrar_recompensa()` usa `xdotool key Escape` + `pkill -9 -f 'tutor_reward_isolated_session'`
- **Estado: COMPLETO**

### § 2 — Recompensas con Caducidad Diaria (rewardService.ts)
- ✅ `activarRecompensa()` valida `dia_semana === new Date().getDay()` antes de activar
- ✅ El frontend no muestra recompensas de otros días
- **Estado: COMPLETO**

### § 3 — Jornadas Estructuradas (DB + lógica)
- ✅ Migración `20260403_jornadas_schema.sql`: tabla `configuracion_jornadas` + columna `hora_asignada TIME NULL` en `tarea_planificada`
- ✅ Migración `20260403_historial_jornadas.sql`: columnas `medal_manana/tarde/noche` en `historial_diario`
- ✅ `useStudentPlan.ts`: filtra tareas por jornada activa (mañana/tarde/noche) y calcula medallas
- ✅ `gamification.ts`: `calcularNivelDiario()` lee `configuracion_jornadas` y guarda medallas en historial
- ✅ `StudentPlanViewer.tsx`: Slots de medallas visibles + `activeJornada` badge
- ✅ `TareaPlanificada` interface incluye `hora_asignada?: string | null`
- ✅ `cloneTaskToPlan()` y `assignAssessmentToPlan()` incluyen `hora_asignada: null`
- **Estado: COMPLETO (lógica backend + cliente)**

### § 5 — Toast de Alertas no invasivas (DictationModule.tsx)
- ✅ Slider de `alertInterval` va hasta `max="300"` (5 min)
- ✅ El alert de atención es un toast flotante en la parte inferior (no modal)
- ✅ Reproduce audio con `new Audio('/notification.mp3')`
- **Estado: COMPLETO**

---

## ❌ PENDIENTE: § 4 — Nuevo Flujo del Tutor

Este es el único bloque sin implementar. Consiste en agregar la capacidad de asignar `hora_asignada` (hh:mm) a cada tarea desde el editor del tutor.

### Problema actual
El `WeeklyPlanManager.tsx` no expone ningún campo para editar `hora_asignada` en las tareas del plan. El tutor no puede clasificar tareas en jornadas desde la UI.

---

## Proposed Changes — § 4

### Componente afectado: `WeeklyPlanManager.tsx`

Dentro de la vista expandida de cada plan (cuando se muestra `DailyRewardsPanel`), añadir un segundo panel: **"Editor de Jornadas por Tarea"**.

#### Flujo UI propuesto
1. El botón "Recompensas" ya expande el plan → añadir un tab o sección "Jornadas" al mismo panel expandido.
2. El tutor ve la lista de `tarea_planificada` del plan (con nombre y día).
3. Cada fila tiene un input `<select>` o `<input type="time">` para asignar `hora_asignada`.
4. Al guardar, se llama `planService.updateTareaPlanificada(id, { hora_asignada })`.

### Servicio: `planService.ts`
- `updateTareaPlanificada()` ya existe y soporta `hora_asignada`. ✅ Sin cambios necesarios.

### Sub-componente nuevo: `TaskJornadaEditor`

Dentro de `WeeklyPlanManager.tsx`, añadir un sub-componente inline que:
- Recibe las `tareas` del plan actual
- Muestra cada tarea con su día y permite asignar la jornada con un grupo de 3 botones (🌅 Mañana | ☀️ Tarde | 🌙 Noche | 🔄 Flexible)
- Cuando el tutor selecciona una jornada, asigna la hora de inicio de esa franja:
  - Mañana → `08:00`, Tarde → `14:00`, Noche → `20:00`, Flexible → `null`
- Botón "Guardar jornadas" hace batch update de las tareas modificadas

#### [MODIFY] [WeeklyPlanManager.tsx](file:///Users/omar/Documents/proyectos/ia-tutor/src/components/WeeklyPlanManager.tsx)

Añadir un segundo panel expandible en la tarjeta del plan (junto a "Recompensas"), accesible con un botón "🕐 Jornadas".

---

## Verification Plan

### Pasos de verificación
1. Crear un plan con varias tareas asignadas a distintos días
2. Abrir el editor de Jornadas desde el tutor y asignar Mañana a una tarea y Noche a otra
3. Verificar en Supabase que `hora_asignada` quedó guardado correctamente
4. En la vista del alumno, cambiar la hora del sistema a la mañana → solo la tarea de mañana y las flexibles deben aparecer
5. Completar todas las tareas de la mañana → verificar que la medalla 🌅 se colorea

---

## Open Questions

> [!IMPORTANT]
> El panel de Jornadas en el Tutor, ¿prefieres que tenga **botones de jornada** (Mañana/Tarde/Noche/Flexible) o un `<input type="time">` libre para que el tutor ingrese la hora exacta?

Los botones son más sencillos de usar. El `<input type="time">` da más control. Actualmente la lógica del frontend usa los rangos de la tabla `configuracion_jornadas` (ej. 12:00-17:59 = Tarde), así que ambos enfoques son compatibles.

