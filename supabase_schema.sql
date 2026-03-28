-- 1. Tipos de Enumeración
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'tutor', 'student');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('dictation', 'domestic', 'reading');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- En caso de que ya exista, intentamos agregar el nuevo valor:
DO $$ BEGIN
    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'reading';
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'assessment';
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'completed', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role user_role NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Tabla de Relaciones Tutor-Alumno
CREATE TABLE IF NOT EXISTS tutor_students (
  tutor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (tutor_id, student_id)
);

-- 4. Tabla de Tareas
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  type task_type NOT NULL,
  status task_status DEFAULT 'pending',
  score INTEGER DEFAULT 0,
  reason_not_done TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  supported_devices TEXT[] DEFAULT '{"desktop", "tablet", "mobile"}',
  image_data BYTEA,
  image_mime_type VARCHAR(50) DEFAULT 'image/webp'
);

-- 5. Tabla de Configuración Global del Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE, -- Asegura una única fila
  attention_message TEXT DEFAULT '¡Hola! ¿Cómo vas? Sigamos juntos.',
  CONSTRAINT one_row CHECK (id)
);

-- 6. Tabla de Sesiones (Persistencia y Antirrebote)
CREATE TABLE IF NOT EXISTS task_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_index INTEGER DEFAULT 0,
  status task_status DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, student_id)
);

-- 7. Evaluaciones Impulsadas por IA
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  time_limit_seconds INTEGER DEFAULT 0,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Resultados de la Evaluación (Wizard UI)
CREATE TABLE IF NOT EXISTS assessment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score DECIMAL(3,1) CHECK (score >= 1.0 AND score <= 7.0),
  answers JSONB,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Catálogo Global de Materias (LMS)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Relación Tutor-Materia (Asignación por Admin)
CREATE TABLE IF NOT EXISTS tutor_subjects (
  tutor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (tutor_id, subject_id)
);

-- 11. Objetivos de Aprendizaje Anidados a Materias
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Plantillas Globales de Evaluación Asociadas a un Objetivo
CREATE TABLE IF NOT EXISTS assessment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time_limit_seconds INTEGER DEFAULT 0,
  questions JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Habilitar RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_templates ENABLE ROW LEVEL SECURITY;

-- 14. Políticas de Acceso (MVP: Permitir todo por simplicidad en demo)
-- Nota: En producción real, estas políticas deben ser más restrictivas.
CREATE POLICY "Permitir todo a usuarios" ON users FOR ALL USING (true);
CREATE POLICY "Permitir todo en tareas" ON tasks FOR ALL USING (true);
CREATE POLICY "Permitir todo en relaciones" ON tutor_students FOR ALL USING (true);
CREATE POLICY "Permitir todo en ajustes" ON system_settings FOR ALL USING (true);
CREATE POLICY "Permitir todo en sesiones" ON task_sessions FOR ALL USING (true);
CREATE POLICY "Permitir todo en evaluaciones" ON assessments FOR ALL USING (true);
CREATE POLICY "Permitir todo en resultados" ON assessment_submissions FOR ALL USING (true);
CREATE POLICY "Permitir todo a materias" ON subjects FOR ALL USING (true);
CREATE POLICY "Permitir todo a tutores materias" ON tutor_subjects FOR ALL USING (true);
CREATE POLICY "Permitir todo a objetivos" ON objectives FOR ALL USING (true);
CREATE POLICY "Permitir todo a plantillas" ON assessment_templates FOR ALL USING (true);

-- 11. Insertar usuario admin inicial (opcional, el código lo crea si no existe)
-- INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');

-- 12. Insertar ajustes por defecto
INSERT INTO system_settings (attention_message) 
VALUES ('¡Hola! ¿Cómo vas? Sigamos juntos.')
ON CONFLICT (id) DO NOTHING;
