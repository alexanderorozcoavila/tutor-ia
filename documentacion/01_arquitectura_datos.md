# Arquitectura de Datos: Tutor IA (Evolución)

Este documento define las modificaciones necesarias al esquema SQL (Supabase/PostgreSQL) para soportar las nuevas épicas.

## 1. Migración a Cloud Storage (Rendimiento)
Actualizamos la tabla `tasks` (o su equivalente) para eliminar el almacenamiento binario en base de datos.
Guardar imágenes como `BYTEA` sobrecarga las consultas y la memoria de la BD. 

```sql
-- Eliminar la sobrecarga binaria
ALTER TABLE tasks DROP COLUMN IF EXISTS image_data;
ALTER TABLE tasks DROP COLUMN IF EXISTS image_mime_type;

-- Añadir referencia al bucket de Supabase
ALTER TABLE tasks ADD COLUMN image_url TEXT; 
-- El Frontend se encargará de subir el archivo comprimido a Supabase Storage y guardar la URL generada aquí.
```

## 2. Persistencia de Sesión (Progreso de Dictado)
Para evitar que un alumno deba reiniciar un dictado si cierra la pestaña, guardamos su avance individualmente. 
Dado que una misma tarea puede ser asignada a múltiples alumnos (o el alumno realiza la tarea asignada como un "Student Task"), utilizaremos una tabla puente de avance.

```sql
CREATE TABLE task_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Progreso del módulo
    current_index INTEGER DEFAULT 0,
    status task_status DEFAULT 'pending',
    
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(task_id, student_id)
);
```

## 3. Módulo de Evaluación (Cuestionarios LLM)
Cuando un tutor genera un cuestionario, guardaremos las preguntas estructuradas en `assessments` y las respuestas del niño en `assessment_submissions`.

```sql
-- Estructura del Cuestionario
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    time_limit_seconds INTEGER DEFAULT 0, -- 0 = sin límite
    questions JSONB NOT NULL, 
    /* Estructura del JSONB questions:
      [
        {
          "q_id": "enum-1",
          "question": "str",
          "options": ["Opción 1", "Opción 2", "Opción 3"],
          "correct_index": 0,
          "explanation": "str"
        }
      ]
    */
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Resultados del Alumno (Evaluación sumativa)
CREATE TABLE assessment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Escala de 1 a 7 de calificación en LATAM/Chile
    score DECIMAL(3,1) CHECK (score >= 1.0 AND score <= 7.0),
    
    -- Respuestas seleccionadas
    answers JSONB, 
    -- {"enum-1": 0, "enum-2": 2}
    
    completed_at TIMESTAMPTZ DEFAULT now()
);
```
