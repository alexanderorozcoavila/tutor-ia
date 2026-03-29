-- Insertar el Tema Base (Original) en la tabla de temas usando un UUID válido
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
    "font": "var(--font-comic-neue)"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE 
SET config = EXCLUDED.config;
