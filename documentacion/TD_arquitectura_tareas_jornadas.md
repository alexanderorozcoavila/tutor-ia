# Documento Técnico (TD): Arquitectura de Tareas en Jornadas y Aislamiento del Kiosco

Este documento sirve como referencia arquitectónica y técnica para la implementación de las siguientes resoluciones y mejoras:
1. Aseguramiento del cierre del Kiosco de Recompensas de Chrome.
2. Caducidad estricta diaria de las recompensas ganadas.
3. Transformación del sistema de niveles a un sistema de Medallas de Jornada (Mañana, Tarde, Noche).
4. Mejora del Panel de Administración del Tutor para gestionar las tareas.
5. Mejoras de User Experience en notificaciones de atención en pantalla a través de *Toasts*.

---

## 1. Aislamiento de Kiosco (Agente Local Linux)

### Problema
Chrome comparte el identificador de procesos del usuario principal. Al intentar destruir el PID que se lanzó para presentar un YouTube Kids en pantalla completa, el sistema se cierra mal y permite al usuario navegar en un entorno no deseado.

### Solución Técnica (`agent.py`)
- Emplearemos el parámetro `--user-data-dir=/tmp/tutor_reward_isolated_session` en vez de usar el entorno genérico del usuario al invocar `google-chrome --kiosk --app=URL`.
- En consecuencia, se crea un "árbol" de procesos completamente disociado de la instancia de Chromium principal que mantiene la aplicación web "IA Tutor".
- El cierre de este proceso se realizará primero inyectando una tecla de salida a nivel del servidor X11 mediante `xdotool key Escape` y seguidamente el asesinato recursivo del patrón *tutor_reward_isolated_session*.

---

## 2. Recompensas con Caducidad Diaria

La función `getRecompensasDiarias` y validaciones conjuntas en `rewardService.ts` deben filtrar las recompensas activables para que su propiedad `dia_semana` empate obligatoriamente con el día actual devuelto por `new Date().getDay()`. Si una recompensa se generó para el día lunes (`1`), y hoy es martes (`2`), no importa que el estudiante haya superado la jornada requerida; la recompensa no se procesará en el Frontend.

---

## 3. Jornadas Estructuradas (Mañana, Tarde, Noche)

Las jornadas ya no incrementan un `nivel_diario` sumativo (ej 80% Nivel 1 -> 90% Nivel 2), sino que ofrecen una medalla **bool** e **independiente** supeditada a superar el 100% de las tareas categorizadas en dicho tramo.

### Esquema PostgreSQL (Supabase)
Se crea la tabla `configuracion_jornadas`.
```sql
CREATE TABLE public.configuracion_jornadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rango_manana VARCHAR(11) DEFAULT '00:00-11:59',
    rango_tarde VARCHAR(11) DEFAULT '12:00-17:59',
    rango_noche VARCHAR(11) DEFAULT '18:00-23:59',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Alteraciones a Tareas**:
La tabla `tarea_planificada` expandirá su estado agregando un campo temporal.
```sql
ALTER TABLE public.tarea_planificada ADD COLUMN hora_asignada TIME NULL;
```

### Reglas de Visualización del Cliente
- **Tareas Flexibles**: Las tareas con `hora_asignada = NULL` aparecerán para el usuario en **todas** las jornadas.
- **Reloj Dinámico**: Dependiendo de la lectura de la hora local (ej. 13:00 hrs), el sistema clasificará al usuario en la "Jornada de la Tarde". Mostrará exclusivamente las tareas flexibles y/o aquellas tareas con `hora_asignada` entre las 12:00 y las 17:59.
- **Medallas**: El alumno visualiza tres Slots (Mañana, Tarde, Noche). Al llegar al 100% de las tareas requeridas para el tramo respectivo, la medalla se colorea.

---

## 4. Nuevo Flujo del Tutor (Dashboard)

El exceso de datos masivos compartidos será refactorizado por completo eliminando la lista global vertical.
El patrón UX será un modelo maestro-detalle de 3 pasos:
1. Modal dropdown / Tarjeta interactiva de `Selección de Alumno`.
2. Expandir los _Planes Semanales_ asociados a ese alumno.
3. Al accionar un _Plan Semanal_, se abre el componente `PlanTasksEditor` o un modal ancho que lista las `tarea_planificada`.

Las funciones de mutación CRUD se incrustarán dentro del editor del plan, permitiendo agregar una hora (`hh:mm`) o borrar rápidamente con un layout optimizado.

---

## 5. UI de Notificaciones no invasivas

En `DictationModule.tsx` y de existir, en `ReadingModule`:
- El slider que controla el tempo de las Alertas de Atención (idle prompt) se ajusta a un máximo de `5 minutos (300)`.
- El popup modal negro/opresor que interrumpía visualmente al niño se sustituye por:
    - Sonido ligero tipo notificación web.
    - Componente estilo Snackbar o Toast en la zona inferior de la pantalla que se autodesvanece sin requerir interacción forzada.
