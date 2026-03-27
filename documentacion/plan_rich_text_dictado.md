# Plan de Implementación: Módulo de Dictado Enriquecido (Rich Text y UX Visual)

Tras la revisión de la Historia de Usuario 1 (HU_1), se ha validado el estado de avance del **Módulo de Dictado Interactivo y Enriquecido**.

## Validación del Estado Actual

### ✅ Lo que SÍ se desarrolló
1.  **Lógica de Segmentación Estricta:** El sistema divide el texto por oraciones usando signos terminales (`.`, `?`, `!`, `\n`) respetando la lectura fluida del TTS en las comas.
2.  **Pausas Inteligentes:** El motor se detiene (`onend`) y espera una acción.
3.  **Control de Flujo Mixto:** Se puede avanzar con la tecla `Espacio` o diciendo palabras clave como "Listo" vía `SpeechRecognition`.
4.  **Bloqueo de Inputs:** Evitar dobles avances validando el estado reproduciendo (`isSpeaking`).

### ❌ Lo que FALTÓ desarrollar (Deuda Técnica)
1.  **Formato de Texto (Rich Text) para el Tutor:** En `TaskCreator.tsx` se sigue usando un `<textarea>` simple en lugar de un editor WYSIWYG que permita títulos, negritas, listas e insertar imágenes.
2.  **Copia Expedita (UX) para el Alumno:** En `DictationModule.tsx` las frases se renderizan como simples `<span>` planos. Falta renderizar el contenido enriquecido manteniendo la jerarquía visual (títulos grandes, saltos estructurales, viñetas) para facilitar la transcripción manual, y sincronizar el resaltado del TTS sobre un contenido estructurado en HTML.

---

## Plan de Acción para Subsanar 

### 1. Integración de Rich Text Editor (Tutor)
Se reemplazará el `<textarea>` del `TaskCreator.tsx` por un editor robusto que soporte formato HTML.
*   **Herramienta sugerida:** `React-Quill` o `@tiptap/react`. Se propone **Tiptap** por ser un editor *headless* moderno y sumamente personalizable con Tailwind, o **React-Quill** por su rapidez de implementación.
*   **Requerimientos:** Habilitar barra de herramientas (Toolbar) con `H1`, `H2`, `bold`, `italic`, `bullet-list`, `ordered-list`, e `image`.
*   **Persistencia:** El contenido se guardará como String HTML en la base de datos dentro del payload del dictado (`dictation_text_html`).

### 2. Procesamiento del Rich Text (Frontend Alumno)
Al cargar el dictado, el `DictationModule` debe realizar dos tareas simultáneas:
1.  **Extracción Pura (Para TTS):** Transformar el DOM/HTML en texto plano (`innerText`) para alimentar el array de fragmentación (`processPhrases`) para el TTS, de modo que lea correctamente ignorando etiquetas.
2.  **Renderizado Estructurado (Para UX Visual):** Renderizar el HTML de forma segura (`dangerouslySetInnerHTML` o un parser como `html-react-parser`).

### 3. El Reto Principal (Sincronización DOM - TTS)
Dado que el texto estará formateado en HTML (ej. `<h1>Título</h1><p>Párrafo.</p><ul><li>Elemento 1</li></ul>`), resaltar la frase precisa que está hablando el motor TTS será técnicamente desafiante. 
*   **Propuesta de Resolución UX (Opción A - Sincronizada):** Utilizar `html-react-parser` para recorrer los nodos y envolver cada segmento de texto ("frase plana") en un `<span id="phrase-X">` durante la carga. Al cambiar el `currentIndex` del dictado, aplicaremos estilos adicionales al ID activo mediante CSS normal.
*   **Propuesta de Resolución UX (Opción B - Visores Separados):** Mostrar al alumno dos zonas: 
    *   Una tarjeta superior principal con la **"Visión Global"** estructurada (HTML renderizado), para ubicación general y copia.
    *   Una zona de enfoque central inferior, con la **Caja Semántica** que muestra en grande *únicamente* la oración que se está dictando (texto plano). 

*Recomendación:* La **Opción B** es altamente preferible para plataformas educativas orientadas a TDAH/TEA, ya que reduce la carga cognitiva. El infante tiene el contexto global, pero su foco atencional auditivo y visual se dirige específicamente a la frase en reproducción aislada del "ruido".

### Resumen de Tareas de Implementación Inmediatas
- [ ] **Tutor:** Instalar `react-quill` o similar en Next.js.
- [ ] **Tutor:** Modificar los estilos del modal/contenedor de `TaskCreator` para que ocupe el 90% del ancho de la pantalla en PC y Tablets.
- [ ] **Tutor:** Cambiar textarea en `config` a Editor. Guardar estructura HTML.
- [ ] **Alumno:** Cambiar interfaz de `DictationModule`. 
- [ ] **Alumno:** Renderizar visión global del fragmento usando estilos jerárquicos de TailwindTypography (prose).
- [ ] **Alumno:** Cambiar lógica extractora de `processPhrases` para ignorar nodos HTML al pre-procesar voz.
- [ ] **Alumno:** Mantener zona de FOCO para la oración en curso.
