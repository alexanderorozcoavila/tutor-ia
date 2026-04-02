-- Update Recompensas table
ALTER TABLE recompensas ADD COLUMN IF NOT EXISTS dispositivo_objetivo text DEFAULT 'all';

-- Create STEM Knowledge Base table
CREATE TABLE IF NOT EXISTS public.stem_knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL, -- math, geometry, science
    title text NOT NULL,
    content_html text NOT NULL,
    interactive_type text, -- quiz, geometric_viewer, experiment
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Initial Data
INSERT INTO public.stem_knowledge_base (category, title, content_html, interactive_type, metadata)
VALUES 
(
    'math', 
    'Introducción a las Fracciones', 
    '<p>Las fracciones nos ayudan a representar partes de un todo. Por ejemplo, si tienes una pizza y la cortas en 4 pedazos iguales, cada pedazo es 1/4 (un cuarto) de la pizza.</p>', 
    'quiz',
    '{"questions": [{"text": "¿Qué representa 1/2?", "options": ["Una mitad", "Un cuarto", "Trés cuartos", "Un entero"], "correctIndex": 0, "explanation": "1/2 literalmente significa 1 parte de 2 iguales, o sea, la mitad."}]}'
),
(
    'geometry', 
    'Figuras Geométricas: El Cuadrado', 
    '<p>Un cuadrado es una figura plana de cuatro lados iguales y cuatro ángulos rectos (90 grados). Significa que en cualquiera de sus esquinas se forma una línea perfecta como una letra "L".</p>', 
    'geometry_viewer',
    '{"shape": "square", "questions": [{"text": "¿Cuántos lados tiene un cuadrado?", "options": ["3", "4", "5", "6"], "correctIndex": 1, "explanation": "El cuadrado se caracteriza por tener 4 lados exactamente iguales."}]}'
),
(
    'science', 
    'El Ciclo del Agua', 
    '<p>El agua se mueve constantemente por la Tierra. El sol calienta el agua y la convierte en vapor (<strong>Evaporación</strong>). Luego, el vapor sube y forma las nubes (<strong>Condensación</strong>). Cuando las gotas de agua en las nubes se hacen muy pesadas, caen como lluvia o nieve (<strong>Precipitación</strong>).</p>', 
    'quiz',
    '{"questions": [{"text": "¿Cómo se llama cuando el vapor de agua forma las nubes?", "options": ["Evaporación", "Precipitación", "Condensación", "Colección"], "correctIndex": 2, "explanation": "La condensación es el proceso mediante el cual el vapor de agua en el aire se transforma en agua líquida, formando nubes."}]}'
);
