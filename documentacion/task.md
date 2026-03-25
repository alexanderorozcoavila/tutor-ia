# Tareas del MVP: IA Tutor

## Fase 1: Arquitectura Base e Infraestructura
- [/] Inicialización del Entorno y Repositorio
- [ ] Configuración de Tailwind y Tipografía Accesible
- [ ] Backend y Base de Datos (Configuración de Supabase local/remota)

## Fase 2: "El Oído y el Cerebro" - Tutoría por Voz
- [ ] Componente y Hook `useTTS` (Texto a Voz)
- [ ] Hook de captura de Audio (`AudioRecorder`)
- [ ] API Route para transcripción con Groq (`/api/transcribe`)
- [ ] API Route de validación con Gemini (`/api/validate-speech`)

## Fase 3: "El Ojo" - Caligrafía Artificial
- [ ] Componente para captura de fotografía (`<input type="file" capture>`)
- [ ] Compresión de imagen en Canvas HTML5
- [ ] API Route de visión con Gemini (`/api/validate-handwriting`)

## Fase 4: Gamificación y Dashboard
- [ ] Contexto global para temporizador de sesión (15 min)
- [ ] Acciones de servidor (XP y progreso)
- [ ] Componentes visuales (Progreso de sesión)
- [ ] Dashboard administrativo (Protegido por middleware)
- [ ] Modo Pantalla Completa Web
