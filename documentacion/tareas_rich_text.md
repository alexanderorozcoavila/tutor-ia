# Tareas: Módulo de Dictado Enriquecido (Rich Text)

## 1. Configuración y Tutor
- [x] Instalar `@tiptap/react` y dependencias (`html-react-parser`).
- [x] Modificar los estilos del modal/contenedor de `TaskCreator` para que ocupe el 90% del ancho de la pantalla en PC y Tablets.
- [x] Implementar componente `RichTextEditor` con barra de herramientas (H1, H2, Bold, Listas, Imágenes).
- [x] Reemplazar `<textarea>` de dictado por `RichTextEditor` en `TaskCreator.tsx`.

## 2. Experiencia del Alumno (DictationModule)
- [x] Aislar el proceso de extracción de texto: crear utilidad `htmlToPlainText` que convierte HTML a texto plano para el motor TTS.
- [x] Modificar la función `processPhrases` para que se alimente del texto plano extraído del HTML.
- [x] Reestructurar UI del Dictado (Opción B - Visores Separados):
  - [x] **Visor Global:** Tarjeta de referencia renderizando HTML formateado con `html-react-parser` y clase `.rich-viewer`.
  - [x] **Visor de Foco:** Tarjeta destacada mostrando únicamente la frase actual dictada.
- [x] Estilizar contenido HTML inyectado con clases `.rich-editor-content` y `.rich-viewer` en `globals.css`.
