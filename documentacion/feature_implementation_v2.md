# Plan de Implementación: Evolución de Plataforma Educativa e Interactiva (v2.1)

Este documento detalla el plan de implementación enfocado en la mejora de la experiencia de usuario (UX) y la optimización de recursos para la versión 2.1 de la plataforma.

---

## 1. Arquitectura de Datos

Para soportar las nuevas funcionalidades de detección de dispositivos y gestión de estados de las tareas, es necesario actualizar el esquema de datos de la base de datos.

### Modelo `Tarea` (Actualización)
Se añade el soporte para especificar los dispositivos en los que la actividad es ejecutable.

```sql
-- Ejemplo de alteración de esquema (PostgreSQL / Supabase)
ALTER TABLE tareas 
ADD COLUMN supported_devices TEXT[] DEFAULT '{"desktop", "tablet", "mobile"}'; 
-- Almacenará un array identificando los dispositivos permitidos.
```

### Modelo `Entrega` / `Respuesta` (Actualización)
Se prepara la tabla para persistir imágenes optimizadas en Base de Datos.

```sql
ALTER TABLE entregas
ADD COLUMN image_data BYTEA, -- Campo BLOB o similar para almacenar los binarios de la imagen
ADD COLUMN image_mime_type VARCHAR(50) DEFAULT 'image/webp';
```

### Estados y Reglas de Negocio en Entregas
*   **Pendiente:** El alumno aún no envía su entrega, o la guardó como borrador. *(Permite subir/cambiar imágenes).*
*   **Enviada:** El alumno envió la entrega y está en espera de revisión. *(Permite cambiar la imagen entregada).*
*   **Aprobada:** El tutor validó y aprobó la entrega. *(Bloquea edición y cambio de imágenes).*
*   **Rechazada:** El tutor rechazó la entrega. *(Bloquea edición/cambio, a menos que se abra un nuevo intento).*

---

## 2. Lógica de Frontend

El Frontend (React/Next.js) deberá manejar la información y restricciones para el alumno basándose en el hardware que utiliza.

### 2.1. Detección del Dispositivo
Se implementará lógica (idealmente a través de un Custom Hook) para identificar el tipo de hardware en tiempo de ejecución.

```typescript
// hooks/useDeviceDetect.ts
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : '';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
  return 'desktop';
};
```

### 2.2. Componente de Listado de Tareas
Todas las tareas se renderizan, pero se analiza la compatibilidad en cada una:

*   **Indicadores Visuales:** Se añadirán iconos de FontAwesome, Lucide o Material UI que representen los dispositivos habilitados para esa `Tarea`.
*   **Bloqueo de Ejecución:**
    ```tsx
    const currentDeviceType = getDeviceType(); // ej: 'mobile'
    const isSupported = task.supported_devices.includes(currentDeviceType);

    if (!isSupported) {
       return (
         <div className="task-card opacity-50 bg-gray-100 cursor-not-allowed">
            <h3>{task.title}</h3>
            <span className="badge-warning">No compatible / Bloqueado para este dispositivo</span>
            <DeviceIcons devices={task.supported_devices} />
         </div>
       );
    }
    ```

---

## 3. Flujograma del Dictado Interactivo

Este módulo transformará texto enriquecido (Rich Text) en una experiencia de dictado segmentada.

### Fases del Procesamiento
1.  **Edición (Tutor):** El texto se crea en un Rich Text Editor garantizando jerarquía visual (títulos grandes, alineación, listas).
2.  **Segmentación:** El texto extraído (limpio de HTML residual) se fragmenta estrictamente en oraciones completas utilizando expresiones regulares sobre los signos de puntuación de fin de frase (`.`, `?`, `!`, `\n`). *(Nota: Las comas no se utilizan para segmentar para evitar fragmentos demasiado cortos. El motor TTS maneja la pausa de la coma de forma natural).*

### Máquina de Estados del Dictado
1.  **`IDLE` (En Reposo):** Esperando inicio manual por el alumno.
2.  **`PLAYING` (Leyendo):** El motor TTS reproduce el fragmento actual respetando pausas gramaticales. Se bloquean los inputs para evitar saltos.
3.  **`PAUSED_WAITING_INPUT` (Pausa Inteligente):** Al dispararse el evento `onend` del fragmento, el motor se detiene y espera a que el alumno transcriba.
    *   **Transición:** El alumno pulsa la tecla `Espacio`/`Enter` o pronuncia una palabra clave ("Siguiente", "Listo"). Se avanza al fragmento index `+ 1` y se vuelve a `PLAYING`.
4.  **`COMPLETED` (Finalizado):** Tarea de dictado terminada.

---

## 4. Especificaciones Técnicas

### 4.1. Módulo Text-to-Speech y Reconocimiento de Voz
*   **Web Speech API:**
    *   `SpeechSynthesisUtterance`: Se utilizará para el motor de dictado (TTS). Permite ajustar el `rate` (velocidad), `pitch` (tono) y reaccionar al evento `onend` para gatillar la "Pausa Inteligente".
    *   `SpeechRecognition`: API nativa para capturar comandos de voz ("Listo", "Ya"). Se mantendrá escuchando en un ciclo (`onend => start()`) mientras el estado sea `PAUSED_WAITING_INPUT`.
*   **Editor Rich Text:** Se recomienda integrar **TipTap** o **Quill** en el panel del tutor. Son extensibles y permiten formateo jerárquico que facilita al alumno la copia expedita.

### 4.2. Pipeline de Compresión de Imágenes
Para asegurar optimización y rendimiento en base de datos.

*   **Librería Principal en Backend:** `Pillow` (PIL) bajo entorno Python.
*   **Flujo:**
    1.  Se recibe el binario/archivo en el endpoint asociado a la entrega de la tarea.
    2.  `Pillow` lee la imagen residente en memoria.
    3.  Se invoca compresión transformándola explícitamente a formato WebP ajustando calidad al 75%.
    4.  El binario resultante se guarda en la base de datos de manera definitiva.

**Implementación de referencia en Python (Backend):**
```python
from PIL import Image
import io

def compress_image_to_webp(image_bytes, quality=75):
    # Cargar la imagen en memoria
    img = Image.open(io.BytesIO(image_bytes))
    
    # Conservar el canal alfa (transparencia). Convertir solo modos incompatibles (ej. P o CMYK) a RGBA o RGB.
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info else "RGB")
        
    output_io = io.BytesIO()
    # Exportar comprimida en WebP
    img.save(output_io, format="WEBP", quality=quality, method=4)
    
    return output_io.getvalue()
```
