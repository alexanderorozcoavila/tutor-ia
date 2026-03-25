-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Perfiles (Padres)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Tabla de Niños (Alumnos)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  theme_preference TEXT DEFAULT 'space', -- space, animals, pirates
  xp_points INT DEFAULT 0
);

-- Tabla de Sesiones (Progreso)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_minutes INT DEFAULT 0,
  activities_completed INT DEFAULT 0,
  mistakes_count INT DEFAULT 0
);

-- RLs (Row Level Security) basics:
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Assuming standard auth setup for tutors
CREATE POLICY "Tutors can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Tutors can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Tutors can view own students" ON students FOR SELECT USING (auth.uid() = tutor_id);
CREATE POLICY "Tutors can insert own students" ON students FOR INSERT WITH CHECK (auth.uid() = tutor_id);
CREATE POLICY "Tutors can update own students" ON students FOR UPDATE USING (auth.uid() = tutor_id);

CREATE POLICY "Tutors can view own students sessions" ON sessions FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE tutor_id = auth.uid())
);
CREATE POLICY "App can insert session" ON sessions FOR INSERT WITH CHECK (true);
