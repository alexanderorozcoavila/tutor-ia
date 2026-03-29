-- Actualizar los temas existentes con la nueva configuración enriquecida (Fuentes, Bordes, Radios)

-- Minecraft
UPDATE themes 
SET config = config || '{
  "font": "var(--font-pixel)",
  "border": "4px",
  "radius": "0px",
  "surface": "#7F7F7F",
  "background": "#89CFF0"
}'::jsonb
WHERE slug = 'minecraft';

-- Sonic
UPDATE themes 
SET config = config || '{
  "font": "var(--font-comic)",
  "border": "2px",
  "radius": "30px",
  "surface": "#ffffff",
  "background": "#00aaff",
  "secondary": "#ffd700"
}'::jsonb
WHERE slug = 'sonic';

-- Marvel
UPDATE themes 
SET config = config || '{
  "font": "var(--font-comic)",
  "border": "3px",
  "radius": "4px",
  "surface": "#ffffff",
  "background": "#ffffff",
  "secondary": "#f4d03f"
}'::jsonb
WHERE slug = 'marvel';
