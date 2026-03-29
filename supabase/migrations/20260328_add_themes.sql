-- New themes table
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add theme_id to users (which stores students)
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES themes(id) ON DELETE SET NULL;

-- Seed initial themes
INSERT INTO themes (name, slug, config) VALUES 
('Minecraft', 'minecraft', '{
  "primary": "#54B223",
  "secondary": "#795548",
  "background": "#89CFF0",
  "surface": "#7F7F7F",
  "border": "4px",
  "fontFamily": "var(--font-comic-neue)"
}'),
('Sonic', 'sonic', '{
  "primary": "#0000ff",
  "secondary": "#ffd700",
  "background": "#00aaff",
  "surface": "#ffffff",
  "border": "20px",
  "fontFamily": "var(--font-comic-neue)"
}'),
('Marvel Heroes', 'marvel', '{
  "primary": "#e23636",
  "secondary": "#f4d03f",
  "background": "#ffffff",
  "surface": "#ffffff",
  "border": "2px",
  "fontFamily": "var(--font-comic-neue)"
}')
ON CONFLICT (slug) DO NOTHING;
