-- 1. Tipos de Enumeración
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'tutor', 'student');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('dictation', 'domestic');
EXCEPTION WHEN duplicate_object THEN null; END $$;

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
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Tabla de Configuración Global del Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE, -- Asegura una única fila
  attention_message TEXT DEFAULT '¡Hola! ¿Cómo vas? Sigamos juntos.',
  CONSTRAINT one_row CHECK (id)
);

-- 6. Habilitar RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de Acceso (MVP: Permitir todo por simplicidad en demo)
-- Nota: En producción real, estas políticas deben ser más restrictivas.
CREATE POLICY "Permitir todo a usuarios" ON users FOR ALL USING (true);
CREATE POLICY "Permitir todo en tareas" ON tasks FOR ALL USING (true);
CREATE POLICY "Permitir todo en relaciones" ON tutor_students FOR ALL USING (true);
CREATE POLICY "Permitir todo en ajustes" ON system_settings FOR ALL USING (true);

-- 8. Insertar usuario admin inicial (opcional, el código lo crea si no existe)
-- INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');

-- 9. Insertar ajustes por defecto
INSERT INTO system_settings (attention_message) 
VALUES ('¡Hola! ¿Cómo vas? Sigamos juntos.')
ON CONFLICT (id) DO NOTHING;
