-- ============================================================
-- Migración: Menú de Acciones del Sistema
-- ============================================================

-- 1. Tabla catálogo de acciones
CREATE TABLE IF NOT EXISTS menu_acciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  icono_emoji TEXT NOT NULL DEFAULT '⚙️',
  comando     TEXT NOT NULL,
  requiere_sudo BOOLEAN NOT NULL DEFAULT false,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla visibilidad por rol
CREATE TABLE IF NOT EXISTS menu_rol_visibilidad (
  accion_id UUID NOT NULL REFERENCES menu_acciones(id) ON DELETE CASCADE,
  rol       TEXT NOT NULL CHECK (rol IN ('admin', 'tutor', 'student')),
  PRIMARY KEY (accion_id, rol)
);

-- 3. RLS
ALTER TABLE menu_acciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_rol_visibilidad  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo en menu_acciones"
  ON menu_acciones FOR ALL USING (true);

CREATE POLICY "Permitir todo en menu_rol_visibilidad"
  ON menu_rol_visibilidad FOR ALL USING (true);

-- 4. Acciones predeterminadas (UUIDs fijos = idempotente)
INSERT INTO menu_acciones (id, nombre, descripcion, icono_emoji, comando, requiere_sudo, orden)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Apagar equipo',
    'Apaga el equipo de forma segura',
    '🔴',
    'shutdown -h now',
    true,
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Reiniciar equipo',
    'Reinicia el equipo de forma segura',
    '🔄',
    'reboot',
    true,
    2
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Asignar ambas acciones a los 3 roles
INSERT INTO menu_rol_visibilidad (accion_id, rol)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'tutor'),
  ('a0000000-0000-0000-0000-000000000001', 'student'),
  ('a0000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'tutor'),
  ('a0000000-0000-0000-0000-000000000002', 'student')
ON CONFLICT DO NOTHING;
