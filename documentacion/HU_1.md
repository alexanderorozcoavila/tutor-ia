# Requerimiento Técnico: Evolución de Plataforma Educativa e Interactiva (v2.1)

**Instrucción para la IA:**
> Actúa como **Senior Fullstack Developer y Arquitecto de Software**. Tu tarea es diseñar un plan de implementación detallado y registrarlo en un archivo llamado `documentacion/feature_implementation_v2.md`. El enfoque debe ser la mejora de la experiencia de usuario (UX) y la optimización de recursos.

---

## 1. Detección de Dispositivos y Visibilidad Informativa
El sistema debe gestionar el acceso al contenido según el hardware, pero manteniendo al alumno informado.
* **Detección:** Implementar lógica para identificar si el usuario accede desde un **Smartphone**, **Tablet** o **Desktop**.
* **Atributo en Tareas:** La entidad `Tarea` debe incluir un atributo configurable (ej. `supported_devices`) que almacene los tipos de dispositivos permitidos.
* **Interfaz del Tutor:** El tutor seleccionará los dispositivos permitidos mediante checkboxes en la creación de la tarea.
* **Regla de Negocio (Acceso Diferenciado):** * El sistema debe validar el dispositivo en tiempo de ejecución.
    * **Visualización:** Todas las tareas asignadas deben ser visibles en el listado del alumno independientemente del dispositivo.
    * **Restricción de Ejecución:** Si el alumno usa un dispositivo no permitido, la tarea aparecerá con un estado "No compatible" o "Bloqueado para este dispositivo" y no podrá ser abierta.
    * **Indicadores Visuales:** Cada tarea en el listado debe mostrar **iconos representativos** (móvil, tablet, pc) que indiquen en qué dispositivos es ejecutable esa actividad específica.

## 2. Módulo de Dictado Interactivo y Enriquecido
* **Formato de Texto (Rich Text):** El tutor utilizará un editor que soporte títulos, subtítulos, alineación, listas y la inserción de imágenes.
* **Copia Expedita (UX):** El texto debe renderizarse con una jerarquía visual clara para facilitar la transcripción manual del alumno.
* **Lógica de Dictado Segmentado:**
    * El sistema fragmentará el texto (oraciones/párrafos).
    * **Pausas Inteligentes:** El motor TTS dictará un fragmento y se detendrá.
    * **Control de Flujo:** El alumno avanzará al siguiente fragmento mediante una **tecla** (Espacio/Enter) o un **comando de voz** ("Listo", "Siguiente", "Ya").
    * La lectura debe ser fluida y respetar la puntuación gramatical.

## 3. Gestión de Imágenes y Optimización
* **Almacenamiento:** Las imágenes se guardarán en la base de datos (campo `BLOB` o similar).
* **Pipeline de Compresión:** Implementar una rutina de procesamiento (formato WebP, calidad 75%) antes de la persistencia para optimizar el espacio.
* **Edición de Entrega:** El alumno podrá subir o cambiar la imagen de su entrega siempre que la tarea no haya sido marcada como **Aprobada** o **Rechazada**.

---

## 4. Estructura Esperada del Plan (`.md`)
1.  **Arquitectura de Datos:** Modelos actualizados para `Tarea` (dispositivos y estados).
2.  **Lógica de Frontend:** Componentes para mostrar iconos de compatibilidad y estados de bloqueo en el listado.
3.  **Flujograma del Dictado:** Manejo de estados y eventos de voz/teclado.
4.  **Especificaciones Técnicas:** Librerías para Web Speech API y compresión de imágenes (ej. Pillow en Python).
