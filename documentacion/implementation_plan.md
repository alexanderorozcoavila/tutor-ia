# Plan de Implementación: Reestructuración de Arquitectura de Tareas y Recompensas

Este documento detalla la estrategia de implementación para resolver el conflicto del Kiosco de Chrome, integrar recompensas con caducidad diaria, estructurar las tareas en "Jornadas" (Mañana, Tarde, Noche), limpiar el Dashboard del Tutor, y mejorar las notificaciones de atención en los módulos de estudio.

---

## 1. Agente Local y Caducidad de Recompensas

### `agent.py`
Se ajustará para garantizar la existencia de **una sola instancia de Chrome a la vez**.
- **[MODIFY]** `agent.py`: 
  - Al ejecutar `lanzar_recompensa()`, se asegura el cierre total del Kiosco con una inyección de `xdotool key Escape` y un `pkill -9 chromium-browser`.
  - Se lanzará la URL de la recompensa con una bandera de perfil temporal `--user-data-dir=/tmp/tutor_reward` para aislar los PIDs.
  - Al caducar el tiempo, cerramos exclusivamente el perfil temporal de recompensa y reiniciamos el Kiosco Principal.

### `src/lib/rewardService.ts`
- **[MODIFY]** `rewardService.ts`: 
  - Ajustar validaciones en `getRecompensasDiarias` para que devuelva explícitamente expiradas las recompensas de días anteriores al actual. Las recompensas no canjeadas en su día (0-6) pasarán al estado bloqueado y no podrán activarse el día siguiente.

---

## 2. Implementación de Jornadas (Mañana, Tarde, Noche)

### Esquema y Base de Datos (Supabase)
- **[NEW]** Migración SQL: `20260403_jornadas_schema.sql`
  - Agregar de campo `hora_asignada` (time, nullable) a la tabla `plan_semanal_tareas`.
  - Crear tabla `configuracion_jornadas` que almacene los rangos horarios definidos por el administrador (ej: Mañana: 06:00 - 12:00, Tarde: 12:00 - 18:00, Noche: 18:00 - 22:00).

### `src/lib/planService.ts` & Gamificación (Medallas)
- **[MODIFY]** `planService.ts`: Al recuperar tareas de un alumno, categorizarlas en la jornada correspondiente basándonos en la hora actual del sistema y la configuración de jornadas.
- **[MODIFY]** `src/lib/actions/gamification.ts`: Se eliminarán los niveles progresivos y se reemplazarán por **Medallas de Jornada**.
  - Cada jornada es totalmente independiente.
  - Si el alumno completa el 100% de las tareas de la Mañana, recibe una **Medalla de Mañana**.
  - Puede existir el escenario donde gane 1, 2 o 3 medallas en el día, dependiendo exclusivamente del 100% de cada bloque temporal.

### `src/components/StudentPlanViewer.tsx` (y Componentes Temáticos)
- **[MODIFY]** `StudentPlanViewer.tsx` / `MinecraftStudentViewer.tsx` / etc.:
  - Leer la hora actual del sistema.
  - Mostrar la categoría actual (ej: "Misiones de la Tarde").
  - Las tareas sin `hora_asignada` son comodines que aparecen siempre en todas las jornadas hasta que sean completadas.
  - Visualizar el rack de trofeos de manera independiente (Medalla Mañana, Medalla Tarde, Medalla Noche) en vez de una barra de progreso que dependa de la anterior.

---

## 3. Depuración y Vista del Tutor

### `src/components/TutorDashboard.tsx` & Flujo de Tareas
- **[MODIFY]** `TutorDashboard.tsx`:
  - Se eliminará la lista gigante combinada y se creará un flujo escalonado: **1. Seleccionar Alumno -> 2. Seleccionar Plan Semanal -> 3. Abrir Panel de Tareas del Plan**.
- **[NEW]** `src/components/PlanTasksEditor.tsx`:
  - Panel visual dedicado exclusivamente a las tareas de un Plan Semanal.
  - Funciones de **Eliminar**, **Modificar Hora (Jornada)** y un botón para **Agregar Nueva Tarea** usando el banco de tareas (con opción de asignar hora opcional).

---

## 4. Mejoras UX en Notificaciones de Atención

### `DictationModule.tsx` y Módulos de Lectura
- **[MODIFY]** Configuración de Dictado: Ampliar el rango del input deslizable (slider) de "Alertas de atención" para llegar hasta un máximo de **5 minutos** (300 segundos).
- **[MODIFY]** Remover el componente de Modal opaco y reemplularlo por un **Toast Notification** no invasivo en la parte inferior.
- **[MODIFY]** Lógica de audio: Reproducir un sonido de alerta corto (burbuja/ringtone) en conjunto al mensaje Toast para llamar la atención del niño sin detener totalmente su interacción principal.

---

## Open Questions

1. **Gestión de Atrasos:** Si un alumno no hace las tareas de la "Mañana", y ya estamos en la "Tarde", ¿esas tareas matutinas desaparecen (se pierden), o se arrastran para hacerse como tareas "atrasadas" pero habilitadas durante la Tarde?
2. **Sonido de Alerta:** Para el nuevo tono de atención, ¿ya existe un archivo de audio como `notification.mp3` en tu carpeta `public/sounds` o agregaré uno que simule un sonido nativo utilizando el sintetizador del navegador / un data-uri base64 estándar?

## Verification Plan

### Automated Tests
- Ejecutar migraciones SQL locales y verificar las mutaciones RPC.
- Correr el agente en simulación (sin root) verificando los argumentos que le pasa a `google-chrome` y validando comandos de _xdotool_.

### Manual Verification
- Administrador: Comprobar el ajuste de las horas de jornada.
- Tutor: Seleccionar plan y editar parámetros horarios.
- Alumno: Falsificar hora local, constatar disponibilidad de tareas, y testear obtención de medallas individuales. Probar notificaciones Toast de 5 minutos en dictado.
