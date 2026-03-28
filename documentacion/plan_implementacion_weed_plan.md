Revisé el documento que te generó la IA. Como Tech Lead, te digo que capturó bastante bien las reglas de negocio (la máquina de estados y los porcentajes escalonados son correctos), pero **introdujo fallas críticas de seguridad y arquitectura** que nos causarían problemas graves en producción.

Aquí tienes mis observaciones de lo que falló en su propuesta:

1.  **Falla de Seguridad (RLS):** En la tabla `historial_diario`, la IA sugirió `CREATE POLICY ... USING (true);`. Esto es un error gravísimo. Volveríamos al problema anterior donde cualquier alumno podría ver los logros de otro alumno.
2.  **Omisión de la Caducidad (23:59 del Domingo):** Puso la restricción de que el plan empiece en Lunes, pero olvidó por completo programar la caducidad. Necesitamos un enfoque técnico para "cerrar" el plan, ya sea calculando la fecha de fin dinámica o usando un cron de base de datos.
3.  **Error SQL (Enum inexistente):** Intenta usar un tipo `task_status` asumiendo que ya existe, lo cual hará que la base de datos tire un error al intentar correr la migración.



***

```markdown
# Documento Arquitectónico: Evolución del Plan Semanal LMS

**Ruta:** `documentacion/plan_implementacion.md`

## 1. Resumen Ejecutivo
Este documento técnico define la evolución arquitectónica del módulo de Planificación Semanal para resolver problemas en el ciclo de vida del plan e introducir un **flujo de aprobación asíncrono** entre el Tutor y el Alumno. Además, implementa un sistema de gamificación diaria (80%, 90%, 100%) que recompensa el esfuerzo continuo.

---

## 2. Arquitectura de Base de Datos (Supabase SQL)
Migraremos de un estado booleano a una máquina de estados para soportar el flujo de "En Revisión", y añadiremos las restricciones de tiempo y tablas de logros.

```sql
-- 1. Creación de la Máquina de Estados (Enum)
CREATE TYPE estado_tarea AS ENUM ('pendiente', 'en_revision', 'completada');

-- 2. Modificación de la Tabla 'tarea_planificada'
ALTER TABLE tarea_planificada ADD COLUMN estado estado_tarea DEFAULT 'pendiente';

-- Migración de datos existentes (Retrocompatibilidad)
UPDATE tarea_planificada SET estado = 'completada' WHERE completada = true;
ALTER TABLE tarea_planificada DROP COLUMN completada;

-- 3. Constraints de Fecha Lógica (Lunes a Domingo)
-- Garantiza que 'fecha_inicio' SIEMPRE sea Lunes
ALTER TABLE plan_semanal
  ADD CONSTRAINT chk_fecha_lunes CHECK (EXTRACT(ISODOW FROM fecha_inicio) = 1);

-- 4. Tabla de Progresión Diaria (Logros Escalonados)
CREATE TABLE historial_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_semanal_id UUID REFERENCES plan_semanal(id) ON DELETE CASCADE,
    alumno_id UUID NOT NULL,
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
    porcentaje_logrado DECIMAL(5,2) DEFAULT 0.00,
    nivel_alcanzado INTEGER DEFAULT 0, -- 1 (80%), 2 (90%), 3 (100%)
    fecha_corte DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(plan_semanal_id, dia_semana)
);

-- Habilitar y configurar RLS de forma segura
ALTER TABLE historial_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alumno_Ve_Su_Historial" ON historial_diario 
    FOR SELECT TO authenticated USING (auth.uid() = alumno_id);

CREATE POLICY "Tutor_Ve_Historial_De_Alumnos" ON historial_diario 
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM plan_semanal p WHERE p.id = plan_semanal_id AND p.tutor_id = auth.uid())
    );
```

---

## 3. Lógica de Negocio y Ciclo de Vida

### A. Bug Fix: Ciclo de Vida y Formularios (`WeeklyPlanManager.tsx`)
* **Problema Actual:** Estado local desincronizado al guardar fechas futuras.
* **Solución (Next.js):** Al seleccionar la fecha en el calendario, el componente debe hacer un refetch con `supabase.from('plan_semanal').select().eq('fecha_inicio', getLunesDeLaSemanaSeleccionada())`. 
* **Renderizado Condicional:** Si la query devuelve un plan, se renderiza `<PlanActivo />`. Si devuelve nulo, se renderiza `<FormularioNuevoPlan />`.

### B. Regla de Caducidad (Domingo 23:59)
Para forzar el cierre de los planes y evitar que los alumnos envíen tareas atrasadas, utilizaremos una validación en el backend (Server Action):
* Calculamos la `fecha_fin` sumando 6 días y 23 horas, 59 minutos a la `fecha_inicio`.
* Si la fecha actual (UTC/Local del usuario) supera esta `fecha_fin`, el Server Action de actualización de tareas retornará un error: `"Este plan ya ha caducado"`.

### C. Flujos de Aprobación por Tipo de Tarea
* **Flujo Autónomo (Módulo `HOGAR`):** `Alumno hace click -> estado cambia a 'completada' -> suma puntos.`
* **Flujo de Revisión (Módulos `DICTADO` / `LECTURA`):** `Alumno termina -> estado cambia a 'en_revision' -> Tutor aprueba en ReviewBoard -> estado cambia a 'completada' -> suma puntos.`

---

## 4. Gamificación y Logros (Cálculo Diario)

Server Action (`server_actions/gamification.ts`) para calcular y registrar el progreso al final del día o al aprobar una tarea.

```typescript
"use server";
import { createClient } from "@/lib/supabase/server";

export async function calcularNivelDiario(planId: string, diaSemana: number, alumnoId: string) {
  const supabase = createClient();

  // 1. Obtener tareas del día
  const { data: tareas } = await supabase
    .from('tarea_planificada')
    .select('puntos_valor, estado')
    .eq('plan_semanal_id', planId)
    .eq('dia_semana', diaSemana);
    
  if (!tareas || tareas.length === 0) return null;

  // 2. Calcular porcentajes (Solo tareas 'completada' suman puntos reales)
  const totalPuntos = tareas.reduce((acc, t) => acc + t.puntos_valor, 0);
  const puntosLogrados = tareas
    .filter(t => t.estado === 'completada')
    .reduce((acc, t) => acc + t.puntos_valor, 0);

  const porcentaje = (puntosLogrados / totalPuntos) * 100;

  // 3. Evaluar Logros
  let nivel = 0;
  if (porcentaje === 100) nivel = 3;       // Día Perfecto
  else if (porcentaje >= 90) nivel = 2;    // Logro Oro
  else if (porcentaje >= 80) nivel = 1;    // Logro Plata

  // 4. Registrar en historial usando RPC o Upsert seguro
  if (nivel > 0) {
     await supabase.from('historial_diario').upsert({
       plan_semanal_id: planId,
       alumno_id: alumnoId,
       dia_semana: diaSemana,
       porcentaje_logrado: porcentaje,
       nivel_alcanzado: nivel,
     }, { onConflict: 'plan_semanal_id, dia_semana' });
  }
  
  return { porcentaje, nivel };
}
```

---

## 5. Plan de Acción (Roadmap Técnico)

1.  **Fase 1: Base de Datos.** Ejecutar scripts de migración (Enum `estado_tarea`, constraints de fechas y tabla de historial con RLS cerrado).
2.  **Fase 2: UI Manager.** Corregir la sincronización del formulario de creación (`WeeklyPlanManager.tsx`) y añadir utilidades de fechas.
3.  **Fase 3: Review Board.** Desarrollar el panel donde el Tutor ve todas las tareas con estado `'en_revision'` y puede aprobarlas/rechazarlas.
4.  **Fase 4: Motor de Gamificación.** Implementar las validaciones de caducidad (Domingo 23:59) y la lógica de cálculo diario con feedback visual (Framer Motion / Canvas Confetti) en el dashboard del alumno.
```
