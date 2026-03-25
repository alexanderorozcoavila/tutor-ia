# Plan de Desarrollo e Implementación: IA Tutor - Apoyo a la Lectoescritura

Este documento detalla el plan técnico y operativo para la construcción del producto "IA Tutor", basado en los requerimientos definidos en el PRD y las Historias de Usuario (HU). El enfoque es un desarrollo ágil y bajo costo (Free Tier) centrado en generar valor para niños con TDA/TEA Nivel 1.

## 1. Arquitectura y Stack Tecnológico

La arquitectura sigue un modelo "Costo $0" aprovechando las capas gratuitas, priorizando baja latencia y accesibilidad.

*   **Frontend (Desktop First):** Next.js 14/15 (React) + Tailwind CSS.
*   **Hosting Frontend:** Vercel (Plan Hobby).
*   **Backend as a Service (BaaS):** Supabase (PostgreSQL + Auth + Storage).
*   **Orquestación de IA:** Vercel AI SDK.
*   **Procesamiento de Lenguaje / Visión:** Google Gemini 1.5 Flash API (text y vision).
*   **Voz a Texto (Speech-to-Text):** Groq API usando Whisper V3 (priorizando velocidad récord).
*   **Texto a Voz (Text-to-Speech):** Web Speech API (Nativo del navegador).

## 2. Fases de Implementación (Roadmap)

El desarrollo se divide en 4 fases principales que permiten iteraciones rápidas y validación temprana del producto.

### Fase 1: Cimientos y Configuración Inicial (Semanas 1 - 2)
**Objetivo:** Establecer la infraestructura base, rutas principales y la autenticación.
*   [ ] Inicialización del proyecto Next.js (`npx create-next-app`).
*   [ ] Configuración de Tailwind CSS con paleta de colores de alto contraste e integración de la fuente *OpenDyslexic*.
*   [ ] Configuración del proyecto en Supabase (Base de datos PostgreSQL, esquemas iniciales de usuarios y progreso).
*   [ ] Integración de Supabase Auth (Login para padres/tutores).
*   [ ] Desarrollo de la interfaz base: layouts, navegación simplificada y dashboard principal (vacío).

### Fase 2: Módulo "Oído y Cerebro" - Tutoría y Lectura (Semanas 3 - 4)
**Objetivo:** Lograr el flujo interactivo básico entre el niño y el tutor de IA mediante voz.
*   [ ] Integración de la **Web Speech API** para que el tutor (IA) hable las instrucciones.
*   [ ] Integración de la captura de audio del micrófono y conexión con **Groq (Whisper V3)** para transcripción rápida.
*   [ ] Configuración del *System Prompt* en **Gemini 1.5 Flash** especializado en TEA/TDA (refuerzo positivo, instrucciones segmentadas).
*   [ ] Lógica de validación: Comparar la transcripción de Groq con la palabra/frase objetivo usando Gemini.
*   [ ] Desarrollo del flujo de interfaz: "Ejemplo de lectura -> Niño lee -> IA valida y responde en < 2 segundos".

### Fase 3: Módulo "Ojo" - Caligrafía Artificial (Semanas 5 - 6)
**Objetivo:** Implementar la captura y validación de escritura manual del niño.
*   [ ] Componente frontend para activar la webcam o permitir la subida de una foto del cuaderno.
*   [ ] Configuración de **Supabase Storage** (temporal) para alojar la imagen antes y durante el procesamiento.
*   [ ] Integración de **Gemini 1.5 Flash (Vision)** para interpretar el trazo del niño y validarlo contra la palabra solicitada.
*   [ ] Implementar tolerancia al fallo (evitar la frustración con errores menores de trazo).

### Fase 4: Gamificación y Panel de Control (Semanas 7 - 8)
**Objetivo:** Añadir retención y visibilidad del progreso para tutores.
*   [ ] Implementar sistema de Puntos de Experiencia (XP) en la base de datos (Supabase).
*   [ ] Desarrollo de UI de recompensas (insignias, barras de progreso y desbloqueo de niveles/temas).
*   [ ] Desarrollo del **Dashboard para Tutores**: Visualizar DAU, Completion Rate, tiempo de atención y errores frecuentes.
*   [ ] Implementar un "Modo Pantalla Completa" vía Web API para reducir distracciones (alternativa inicial al "Modo Kiosko").

## 3. Prácticas de Desarrollo y Herramientas

*   **Control de Versiones:** Repositorio en GitHub. Flujo de trabajo con Pull Requests para revisión.
*   **Gestión de Tareas:** Jira / Trello / GitHub Projects con metodología Kanban.
*   **Diseño:** Prototipado en Figma antes de programar componentes clave, cuidando el "Ruido Visual".
*   **Despliegue Continuo (CI/CD):** Vercel integrado con la rama `main` de GitHub.

## 4. Gestión de Riesgos y Mitigaciones

| Riesgo | Impacto | Estrategia de Mitigación |
| :--- | :--- | :--- |
| **Alta Latencia en STT/IA** | Frustración del niño, abandono | Uso de Groq (Whisper) y validación estricta de tiempos (<2s). Fallback a mensajes pregrabados si hay lag. |
| **Falsos Negativos en Visión** | Desmotivación por corrección injusta | Ajustar el prompt de Gemini Vision para ser muy permisivo con trazos irregulares, premiando la intención. |
| **Costos Inesperados en APIs** | Ruptura del modelo "Free Tier" | Configurar límites duros ("hard limits") y alertas de facturación en Google AI Studio y Groq. |
| **Abandono por Fatiga** | Fracaso del objetivo clínico | Limitar por código las sesiones a 15 minutos exactos (auto-cierre con premio). |

## 5. Próximos Pasos (Inmediato)
1.  Crear el repositorio de código base.
2.  Configurar las cuentas y claves API (Supabase, Vercel, Google AI Studio, Groq).
3.  Desplegar el "Hola Mundo" en Next.js.
4.  Realizar una prueba de concepto (PoC) aislada del STT (Groq) -> Procesamiento (Gemini) -> TTS (Web API) para medir la latencia real.
