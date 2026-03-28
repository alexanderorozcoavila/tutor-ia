# Arquitectura Evolutiva y Plan de Implementación: EdTech Platform (LMS)

## 1. Visión Estratégica
La transición hacia un sistema LMS orientado a metas semanales aborda dos puntos críticos observados:
- **Alivio Cognitivo (TEA/TDAH)**: La rutina semanal estructurada (Lunes a Domingo) reduce la ansiedad en estudiantes brindando anticipación mediante un componente de barra de progreso optimista y una meta de puntos bien definida.
- **Automatización (Tutor)**: El esquema de planificación elimina la fricción de "creación diaria de tareas", clonando actividades genéricas recurrentes (Ej. Tareas de Hogar).

## 2. Arquitectura de Datos: Esquema de Supabase

Este esquema asegura integridad bajo lógica polimórfica sin generar un acoplamiento duro que rompa los módulos existentes de la plataforma (Dictado, Lectura, Evaluaciones, Hogar).

```sql
-- Extensión para IDs seguros
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de Planificación
CREATE TABLE plan_semanal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_inicio DATE NOT NULL,          -- Lunes de la semana
    tutor_id UUID REFERENCES auth.users NOT NULL,
    alumno_id UUID NOT NULL,             
    meta_puntos_total INTEGER DEFAULT 0, 
    recompensa_nombre TEXT NOT NULL,
    recompensa_detalle TEXT,             -- Integración con Tiptap
    esta_lograda BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alumno_id, fecha_inicio)
);

-- Habilitación de RLS y Políticas (Asumiendo que alumnos y tutores operan vía auth.users o proxy logic)
ALTER TABLE plan_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los tutores gestionan sus planes" ON plan_semanal 
FOR ALL USING (auth.uid() = tutor_id);

CREATE POLICY "Los alumnos ven sus planes de estudio" ON plan_semanal 
FOR SELECT USING (true); -- Adaptar subconsulta según estrategia de relación local

-- Tabla de Tareas Híbrida (Polimórfica)
CREATE TABLE tarea_planificada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_semanal_id UUID REFERENCES plan_semanal(id) ON DELETE CASCADE, 
    
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6), 
    puntos_valor INTEGER NOT NULL DEFAULT 10,
    completada BOOLEAN DEFAULT FALSE,
    fecha_completado TIMESTAMPTZ,
    
    tipo_modulo TEXT NOT NULL, -- Enum: 'HOGAR', 'DICTADO', 'LECTURA', 'EVALUACION'
    modulo_id UUID NOT NULL,   -- Referencia lógica blanda al módulo específico
    
    alumno_id UUID NOT NULL,
    orden_visual INTEGER DEFAULT 0 
);

ALTER TABLE tarea_planificada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutores escriben tareas planificadas" ON tarea_planificada 
FOR ALL USING (EXISTS (SELECT 1 FROM plan_semanal p WHERE p.id = plan_semanal_id AND p.tutor_id = auth.uid()));

CREATE POLICY "Alumnos completan tareas" ON tarea_planificada 
FOR UPDATE USING (true); -- Restringir al alumno actual si aplica.
```

## 3. Lógica de Sistema (Negocio)

### 3.1. Server Action: Fallback de Modos
Desplegaremos una lógica dual en la página principal o servidor (Server Component en Next App Router):
1. **Modo Guiado (Planificación Activa)**: Consultamos la existencia de un registro en `plan_semanal` para el lunes en curso del Alumno. Se sirven estructuradamente las actividades del `dia_semana == hoy`.
2. **Modo Libre (Sin Plan)**: Retrocompatibilidad. La plataforma llama por defecto a `tasks` crudas para el día.

### 3.2. Clonación Acelerada (Tutor)
Cuando un tutor agregue un reto de Hogar ("Lavar los Platos") y marque "Lunes a Domingo", el Frontend emitirá 7 llamadas de Inserción (o 1 llamada masiva) a `tarea_planificada`, relacionando cada `dia_semana (0-6)` bajo el mismo `plan_semanal_id` y `modulo_id`. Esta capa de abstracción descongestiona la base de tareas maestras (Solo un registro en `tasks`, clonado referencialmente 7 veces).

### 3.3. Metas y Recompensas Optimizadas
Dado que un componente core para niños es el Refuerzo Positivo:
- Al momento de completar una tarea, el cliente Next.js usará un `useOptimistic` hook (React 19 pattern). La barra de progreso de puntos vuela visualmente sumando los X puntos (Ej. +10). 
- El Frontend verificará: `SI optimista(puntos) >= meta_puntos_total ENTONCES showReward()`.
- La activación de la función renderizará simultáneamente el detalle de la meta desde el campo HTML `recompensa_detalle` y disparará el efecto de victoria (`canvas-confetti`).

## 4. Estilos y Accesibilidad (Frontend con Tailwind V4)

Alineados a principios de Accesibilidad para Espectro Autista / TDAH:

- **Bajo Ruido Visual**: Remplazar componentes de animaciones cíclicas infinitas genéricas (`spinners`) por `Skeleton` loaders fluidos y suaves ante tiempos muertos de la base de datos (Ej. `<div className="animate-pulse bg-gray-200 rounded-xl h-24...">`).
- **Iconografía Sensorialmente Amigable**: Garantizar que todo botón táctil en móviles (`min-height: 44px`) emplee iconos con atributos perceptibles de `lucide-react` de al menos `size={24}`.
- **Microinteracciones Positivas**: Las tarjetas como `CardTarea` emplearán clases neutras estandarizadas (ej. `bg-white border-2 border-gray-100`) y mutarán hacia un esquema altamente afirmatorio (ej. `border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md transition-colors`) *tras* ser marcadas exitosamente.

---

*Fecha de Generación: 2026-03-27*
