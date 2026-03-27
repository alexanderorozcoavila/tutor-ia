# Lista de Tareas: Implementación v2.1

## 1. Arquitectura de Datos (Supabase / Base de Datos)
- [x] Actualizar esquema de base de datos (`supabase_schema.sql` o migraciones).
  - [x] Añadir columna `supported_devices` (arreglo de texto) en `tareas`.
  - [x] Añadir columnas `image_data` (BYTEA) y `image_mime_type` en `entregas`.
- [x] Actualizar los tipos de TypeScript autogenerados o manuales que representan las entidades en el Frontend.

## 2. Frontend: Detección de Dispositivos y UI de Tareas
- [x] Crear Hook `useDeviceDetect` para identificar dispositivo actual (Mobile, Tablet, Desktop).
- [x] Panel del Tutor: Añadir checkboxes de selección de `supported_devices` en la creación y edición de Tareas.
- [x] Panel del Alumno: Modificar el componente de Listado de Tareas.
  - [x] Renderizar íconos visuales de dispositivos permitidos.
  - [x] Implementar validación de bloqueo si el dispositivo actual no está en la lista de soportados de la tarea.

## 3. Frontend: Módulo de Dictado Segmentado
- [x] Crear la función de limpieza y segmentación estricta por oraciones (`.`, `?`, `!`, `\n`).
- [x] Desarrollar el sistema de estados (`IDLE`, `PLAYING`, `PAUSED_WAITING_INPUT`, `COMPLETED`).
- [x] Integrar el motor TTS (`SpeechSynthesisUtterance`) con manejador del evento `onend` para gatillar la pausa automatizada.
- [x] Implementar los *listeners* de eventos de teclado (`Espacio`/`Enter`) para el avance manual de fragmentos.
- [x] Integrar un modelo/hook STT (`SpeechRecognition`) para habilitar el avance por comandos de voz ("Listo", "Siguiente").

## 4. Pipeline de Imágenes y Backend
- [x] Establecer el entorno o endpoint de procesamiento de imágenes (Node.js/Next.js o Python).
- [x] Desarrollar función de compresión a formato WebP preservando modo RGBA (transparencias).
- [x] Conectar la interfaz de entrega del alumno con la persistencia en DB del archivo BLOB/BYTEA.
- [x] Implementar validaciones en BD o en el endpoint para impedir sobrescribir entregas en estado "Aprobada" o "Rechazada".
