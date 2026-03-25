# Documento de Diseño Técnico (TD) - IA Tutor MVP

Este documento define el paso a paso técnico detallado para la implementación del MVP "IA Tutor" orientado a niños con TDA/TEA Nivel 1. Cada paso incluye el stack tecnológico, los comandos necesarios, y las consideraciones logísticas de la arquitectura de "Costo Cero" basada en APIs gratuitas.

---

## 🚀 Fase 1: Arquitectura Base e Infraestructura (Semanas 1-2)

### Paso 1.1: Inicialización del Entorno y Repositorio
**Objetivo:** Levantar la estructura de Next.js 14/15 con la configuración correcta.

1.  **Ejecución de scaffolding:**
    ```bash
    npx create-next-app@latest ia-tutor --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
    ```
    *Justificación técnica:* Usar el `app` router para Server Components y `src` para separar configuración del código fuente.

2.  **Instalación de dependencias clave:**
    ```bash
    npm install @supabase/supabase-js @supabase/ssr lucide-react ai
    npm install -D prettier eslint-config-prettier
    ```

3.  **Variables de Entorno (`.env.local`):**
    Configurar un archivo con los *endpoints* vacíos a completar:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=
    GROQ_API_KEY=
    GEMINI_API_KEY=
    ```

### Paso 1.2: Configuración de Tailwind y Tipografía Accesible
**Objetivo:** Adaptar UI para dislexia y TEA (Bajo ruido visual).

1.  **Fuente OpenDyslexic / Inter:** Instalar y configurar en el `layout.tsx` a través de `next/font/google` para la principal (ej. Inter o Comic Neue) y buscar una alternativa local/CDN para OpenDyslexic si se desea.
2.  **Tailwind `tailwind.config.ts`:**
    *   Definir paleta de **Bajo Contraste Perjudicial**: Colores neutros suaves (pasteles) para el fondo, colores sólidos para letras.
    *   Desactivar *animations* por defecto (o reducirlas usando variables booleanas globales como `prefers-reduced-motion`) para no distraer al niño.

### Paso 1.3: Backend y Base de Datos (Supabase)
**Objetivo:** Configuración de tablas e interfaces (TypeScript).

1.  **Proyecto en Supabase:** Crear proyecto (Capa gratuita).
2.  **Esquema SQL Inicial:**
    ```sql
    -- Tabla de Perfiles (Padres)
    CREATE TABLE profiles (
      id UUID REFERENCES auth.users ON DELETE CASCADE,
      email TEXT UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Tabla de Niños (Alumnos)
    CREATE TABLE students (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tutor_id UUID REFERENCES profiles(id),
      name TEXT NOT NULL,
      theme_preference TEXT DEFAULT 'space', -- space, animals, pirates
      xp_points INT DEFAULT 0
    );

    -- Tabla de Sesiones (Progreso)
    CREATE TABLE sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      student_id UUID REFERENCES students(id),
      date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      duration_minutes INT,
      activities_completed INT,
      mistakes_count INT
    );
    ```
3.  **Seguridad (RLS):** Configurar políticas RLS para que un tutor (padre) solo pueda hacer `SELECT`, `INSERT`, `UPDATE` de su perfil y sus niños usando la función `auth.uid()`.

---

## 🎤 Fase 2: "El Oído y el Cerebro" - Tutoría por Voz (Semanas 3-4)

### Paso 2.1: Implementación Texto a Voz (TTS)
**Objetivo:** El Tutor saluda y da instrucciones de forma guiada en < 1 segundo de latencia.

1.  **Web Speech API:** No usamos API externa de pago para salir (TTS), sino la nativa del navegador para mantener latencia nula y costo cero.
2.  **Hook personalizado `useTTS.ts`:**
    ```tsx
    // Lógica para instanciar `new SpeechSynthesisUtterance()`
    // Setear `voice` a una voz española amigable (pitch levemente alto, rate más lento).
    ```
    *Restricción Técnica:* El navegador requiere interacción humana previa (un click o tab) para permitir la síntesis de voz. Implementar un botón "¿Empezamos?".

### Paso 2.2: Implementación Voz a Texto (STT) - Microfono
**Objetivo:** Grabar audio del niño y obtener texto casi instantáneo.

1.  **Componente `AudioRecorder`:** Usar `MediaRecorder API` para grabar fragmentos cortos (chunks).
2.  **Llamada al Backend/API Route:** Cuando termina de hablar (pausa de 1.5s detectada o botón soltado), transformar el Blob de audio en base64 o formData.
3.  **Integración con Groq (Whisper V3):** Crear archivo `app/api/transcribe/route.ts`.
    ```typescript
    // POST request al endpoint de Groq (https://api.groq.com/openai/v1/audio/transcriptions)
    // Enviar el archivo para retornar la respuesta de texto.
    // Usar Groq es crítico aquí porque corre Whisper a cientos de tokens por segundo, evitando la espera.
    ```

### Paso 2.3: Cerebro IA - Google Gemini 1.5 Flash
**Objetivo:** Validar si lo que el niño dijo es correcto, simulando el nivel del TDA/TEA.

1.  **Vercel AI SDK:** Instalar `@ai-sdk/google`.
2.  **API Route `app/api/validate-speech/route.ts`:**
    *   **Input:** La palabra objetivo ("Casa") y lo que transcribió Groq ("Cas... caca").
    *   **System Prompt Crítico (Gemini):**
        *"Eres un tutor experto en TEA nivel 1. Tu alumno tiene que leer {X}. El alumno dijo {Y}. Responde estrictamente en formato JSON: { "status": "success|retry", "tutor_message": "..." }. Nunca digas 'incorrecto'. Si falla, da una pista fonética amigable."*
3.  **Lógica del Frontend:** Recibe el `tutor_message` en JSON y lo pasa al hook `useTTS` para que la app le hable al niño.

---

## 👁️ Fase 3: "El Ojo" - Caligrafía Artificial (Semanas 5-6)

### Paso 3.1: Captura de Imagen (Webcam/Upload)
**Objetivo:** Que el niño tome una foto de su escritura en papel.

1.  **Input Fotográfico:** Implementar `<input type="file" accept="image/*" capture="environment">`. En tablets abrirá la cámara directamente.
2.  **Reducción en cliente:** Usar un canvas HTML5 para achicar la imagen a < 1MB de resolución antes de enviarla, ahorrando ancho de banda y latencia.

### Paso 3.2: Endpoint de Visión Artificial (Gemini Vision)
**Objetivo:** Analizar la caligrafía mediante Gemini 1.5 Flash (Multimodal).

1.  **API Route `app/api/validate-handwriting/route.ts`:**
    *   **SDK:** Usar el mismo `@ai-sdk/google` pasando el base64 de la imagen en los `messages`.
    *   **Prompt de Visión:**
        *"Analiza esta imagen manuscrita infantil. La palabra a escribir era '{Word}'. Los niños pueden tener trazos irregulares, letras invertidas (dislexia temporal) o mala iluminación. Examina si la intención es comprensible. Retorna formato JSON: { "success": boolean, "message": "Mensaje motivador", "detected_word": "Palabra que crees que escribió" }"*.

### Paso 3.3: Storage Temporal
*   **Condición Legal:** Si las imágenes se guardaran, deben estar en un bucket temporal de Supabase (cron job para borrar a los 5 minutos) o, idealmente, **no guardarlas** y pasarlas en memoria directamente de Next.js a la API de Google, descartando el buffer de RAM inmediatamente. *Por requerimiento de privacidad, se opta por pasarlas en memoria.*

---

## 🎮 Fase 4: Gamificación y Dashboard (Semanas 7-8)

### Paso 4.1: Sistema de Recompensa
1.  **Context/Provider Global (`SessionContext`):** Mantener un temporizador de 15:00 minutos.
2.  **Base de Datos XP:**
    *   Cada vez que `validate-speech` o `validate-handwriting` retorna `success: true`, disparar un Server Action de Next.js: `updateStudentXP(studentId, +10)`.
3.  **Componentes UI:**
    *   `ProgressBar`: Componente visual prominente en la cabecera.
    *   Modales de medallas: Al llegar a 100XP, mostrar confeti (ej. librería `react-confetti`).

### Paso 4.2: Dashboard para Tutores
**Objetivo:** Interfaz privada protegida por sesión.

1.  **Rutas Protegidas:** Usar el `middleware.ts` de Next.js en la carpeta `/dashboard` para asegurar que solo usuarios con sesión Supabase puedan entrar.
2.  **Server actions para recolección de datos:**
    *   `getWeeklyStats(tutor_id)`
    *   Mostrar gráficas simples (ej. `recharts`) mostrando:
        *   Días con 15 minutos completados.
        *   Tipos de errores más frecuentes (Si el niño siempre tropieza con la 'P' vs 'Q').

### Paso 4.3: Modo Kiosko / Pantalla Completa Web
**Limitación:** El navegador por seguridad no puede bloquear el SO.
**Implementación Técnica Permitida:**
1.  API `Element.requestFullscreen()` tan pronto empiece el ejercicio.
2.  Escuchar el evento `fullscreenchange` y mostrar una "Alerta de Distracción" amigable al niño si minimiza la pantalla.

---

## 🧪 Pruebas y Despliegue

1.  **Despliegue Continuo (CI/CD):**
    *   Conectar Vercel al repositorio de GitHub.
    *   Mapear las variables de entorno de producción en el panel de Vercel.
2.  **Seguridad y Costes:**
    *   Añadir Rate Limiting (ej. Upstash Redis + Vercel Middleware) limitando las llamadas API por IP a 20 por minuto, para prevenir abuso de las cuotas de Gemini y Groq.
3.  **Monitoreo:**
    *   Revisar los logs de funciones Serverless en Vercel para identificar excepciones al transcribir o validar palabras.
