Como **Líder Técnico y PO**, aquí tienes el **PRD (Product Requirements Document)** inicial. Este documento es la "Biblia" del proyecto: define qué vamos a construir, para quién y cómo mediremos el éxito, manteniendo el enfoque en **costo cero** y **TDA/TEA Nivel 1**.

---

# PRD: IA Tutor - Apoyo a la Lectoescritura (MVP)

## 1. Resumen Ejecutivo
Una aplicación web diseñada para niños de 6 a 10 años con TDA o TEA Nivel 1. Utiliza Inteligencia Artificial para actuar como un tutor personalizado que guía al niño en ejercicios de lectura en voz alta y escritura manual (caligrafía), utilizando gamificación para mantener la atención.

## 2. Objetivos de Negocio
* **Reducir la brecha de aprendizaje:** Fortalecer la lectoescritura mediante práctica diaria guiada.
* **Retención:** Lograr que el niño complete sesiones de 15 minutos sin frustración.
* **Validación de Producto:** Confirmar que el feedback de la IA es preciso y motivador antes de escalar a una versión de pago.

## 3. Público Objetivo (User Personas)
* **El Estudiante:** Niño con TDA/TEA Nivel 1, con capacidad de habla, que se distrae fácilmente y requiere instrucciones claras y refuerzo positivo.
* **El Tutor/Padre:** Adulto que necesita supervisar el progreso sin tener que estar presente en cada minuto de la práctica.

## 4. Requerimientos Funcionales (Scope)

### 4.1. Módulo de Tutoría IA
* **Persona de la IA:** El sistema debe presentarse como un "compañero de aventuras" con voz clara (Web Speech API).
* **Instrucciones segmentadas:** La IA debe dar una sola instrucción a la vez (ej: "Ahora, lee la palabra que aparece en pantalla").

### 4.2. Módulo de Lectura (Audio)
* **Reconocimiento:** Captura de audio vía micrófono.
* **Validación:** Uso de **Whisper (vía Groq)** para transcribir y **Gemini** para comparar la lectura del niño con el texto objetivo.
* **Feedback:** Si el niño falla, la IA debe animar a intentar de nuevo con una pista fonética.

### 4.3. Módulo de Escritura (Visión)
* **Captura:** El niño muestra su cuaderno a la webcam o sube una foto.
* **Análisis:** **Gemini 1.5 Flash** analiza la imagen para validar que la palabra escrita coincide con el ejercicio.

### 4.4. Gamificación y Logros
* **Puntos de Experiencia (XP):** Otorgados por cada intento exitoso.
* **Niveles:** Desbloqueo de nuevos temas (ej: animales, espacio, piratas).

## 5. Requerimientos No Funcionales
* **Latencia:** El feedback de voz debe ocurrir en menos de 2 segundos.
* **Accesibilidad:** Interfaz limpia, sin pop-ups intrusivos, fuentes grandes y legibles (OpenDyslexic).
* **Seguridad:** Cumplimiento con la privacidad de datos de menores (no se almacenan rostros, solo texto y trazos).

## 6. Stack Tecnológico (Free Tier)
| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | Next.js + Tailwind CSS (Vercel) |
| **Base de Datos** | Supabase (PostgreSQL) |
| **Lógica IA / Visión** | Google Gemini 1.5 Flash |
| **Voz a Texto** | Groq (Whisper V3) |
| **Texto a Voz** | Web Speech API (Nativo) |

---

## 7. Plan de Lanzamiento (Milestones)

1.  **M1: Prototipo Funcional (Semana 2):** Flujo básico de "IA habla -> Niño lee -> IA valida".
2.  **M2: Módulo de Caligrafía (Semana 4):** Integración de visión artificial para corregir fotos de cuadernos.
3.  **M3: Beta Cerrada (Semana 6):** Pruebas con 5-10 usuarios reales para ajustar el tono del tutor.

---

## 8. Métricas de Éxito (KPIs)
* **DAU (Daily Active Users):** Frecuencia de uso diario.
* **Completion Rate:** Porcentaje de ejercicios terminados vs. iniciados.
* **Error Rate de la IA:** Cuántas veces la IA falla en entender al niño (objetivo: < 10%).

---

http://googleusercontent.com/interactive_content_block/0