-- Tipos de roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'tutor', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role user_role NOT NULL,
  created_by UUID REFERENCES users(id) -- Para que los tutores creen alumnos
);

-- Tabla principal de tareas (actualizada)
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
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Políticas simples (Permitir todo para el MVP, ajustar luego)
CREATE POLICY "Permitir lectura para todos" ON tasks FOR SELECT USING (true);
CREATE POLICY "Permitir inserción para todos" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización para todos" ON tasks FOR UPDATE USING (true);
