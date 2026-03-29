-- Actualización de Temas Refinados (v3)
-- Este script sincroniza Supabase con la nueva estética: colores, tipografía y opacidad.

-- Actualizar Tema Base / Original
INSERT INTO themes (id, name, slug, config)
VALUES (
  'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0', 
  'Original', 
  'base', 
  '{
    "primary": "#6366f1",
    "secondary": "#818cf8",
    "background": "#fdfbf7",
    "surface": "#ffffff",
    "border": "1px",
    "radius": "1rem",
    "font": "var(--font-comic-neue)",
    "bgOpacity": 1
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;

-- Actualizar Tema Minecraft (Verde bosque + Celeste pálido)
INSERT INTO themes (id, name, slug, config)
VALUES (
  'b10c202a-1111-4444-8888-000000000001', 
  'Minecraft', 
  'minecraft', 
  '{
    "primary": "#2d6a4f",
    "secondary": "#795548",
    "background": "#F0F9FF",
    "surface": "#ffffff",
    "border": "4px",
    "radius": "0px",
    "font": "var(--font-pixel)",
    "bgOpacity": 0.1
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;

-- Actualizar Tema Sonic (Azul real + Amarillo suave)
INSERT INTO themes (id, name, slug, config)
VALUES (
  'b10c202a-2222-4444-8888-000000000002', 
  'Sonic', 
  'sonic', 
  '{
    "primary": "#1d4ed8",
    "secondary": "#fbbf24",
    "background": "#EFF6FF",
    "surface": "#ffffff",
    "border": "2px",
    "radius": "30px",
    "font": "var(--font-comic)",
    "bgOpacity": 0.05
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;

-- Actualizar Tema Marvel (Rojo profundo + Blanco puro)
INSERT INTO themes (id, name, slug, config)
VALUES (
  'b10c202a-3333-4444-8888-000000000003', 
  'Marvel', 
  'marvel', 
  '{
    "primary": "#dc2626",
    "secondary": "#fbbf24",
    "background": "#ffffff",
    "surface": "#ffffff",
    "border": "3px",
    "radius": "4px",
    "font": "var(--font-comic)",
    "bgOpacity": 0.03
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;
