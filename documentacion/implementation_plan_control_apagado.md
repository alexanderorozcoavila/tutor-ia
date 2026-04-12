# Optimización de Sincronización de Configuración Móvil (tv_control.py)

Este plan de implementación propone migrar la arquitectura de "polling" (consultas constantes a la base de datos cada N segundos) a una arquitectura "event-driven" utilizando NTFY.sh para envíos push, de acuerdo con las especificaciones del documento `PRD-mejoras-script-apagado.md`.

## User Review Required

> [!WARNING]
> La migración dividirá la responsabilidad del script de Termux en dos. Esto requerirá que el usuario vuelva a correr el script de configuración inicial en su móvil Termux para aplicar los cambios o actualice su `~/.termux/boot/start_tv_control.sh` localmente para iniciar ambos scripts.
> 
> Usaremos el ID del estudiante para crear un canal único en NTFY (ej: `ntfy.sh/iatutor_tv_config_{student_id}`). ¿Estás de acuerdo con este enfoque o prefieres definir un canal personalizado en las variables de entorno (`.env`)?

## Proposed Changes

### Backend (Next.js)

Se actualizará la acción de servidor para emitir un evento a NTFY cada vez que se guarda una configuración exitosamente en Supabase. Node.js realizará un `POST` al canal correspondiente.

#### [MODIFY] [tvConfigActions.ts](file:///Users/omar/Documents/proyectos/ia-tutor/src/actions/tvConfigActions.ts)
- En `upsertTvConfig(...)`, inmediatamente después de interactuar con Supabase sin error, agregar una petición `fetch` a `https://ntfy.sh/iatutor_tv_config_${student_id}`.
- El cuerpo de la petición (`body`) contendrá el JSON de la configuración recién obtenida de Supabase.

---

### Scripts de Termux (Android)

Dividiremos la arquitectura local de Termux para cumplir el desacoplamiento de procesamiento y conexión de red requerido por el PRD.

#### [NEW] [tv_network_listener.py](file:///Users/omar/Documents/proyectos/ia-tutor/scripts/tv_network_listener.py)
 - Será el "Script A" mencionado en el PRD.
 - Se encargará **exclusivamente** de conectarse y mantener viva una conexión HTTP por streaming hacia `https://ntfy.sh/iatutor_tv_config_${STUDENT_ID}/json`.
 - Al recibir un mensaje con el payload, escribirá la configuración en `~/tv_config_temp.json` y usará `os.replace` para mutarlo atómicamente hacia `~/tv_config.json`.
 - Implementa una espera exponencial (Exponential Backoff) en caso de que Termux se quede sin conexión Wi-Fi, reconectando silenciosamente de fondo.

#### [MODIFY] [tv_control.py](file:///Users/omar/Documents/proyectos/ia-tutor/scripts/tv_control.py)
 - Pasará a ser el "Script B" mencionado en el PRD.
 - **Eliminar:** `fetch_config()` y todas las llamadas a la API de Supabase `requests.get` que actualmente ocurren en cada iteración del bucle principal.
 - **Agregar:** Importar la librería `watchdog` para observar cambios (eventos inotify) en `~/tv_config.json`.
 - Las validaciones de encendido/apagado actuarán exclusivamente usando la variable de memoria cargada desde el último archivo JSON válido leído. 
 - El bucle iterará de manera local (con un `time.sleep()`), reaccionando ante el archivo JSON y controlando la TV sin consumir peticiones web.

#### [MODIFY] [setup_termux.sh](file:///Users/omar/Documents/proyectos/ia-tutor/scripts/setup_termux.sh)
 - Añadir `watchdog` a las librerías instaladas por `pip`.
 - Copiar `$SCRIPT_DIR/tv_network_listener.py` a `$HOME/tv_network_listener.py`.
 - Modificar el script de arranque `start_tv_control.sh` (para `Termux:Boot`) para que lance tanto `tv_network_listener.py` como `tv_control.py` en background con `&`.

## Open Questions

1. ¿El Next.js corre directamente en la Raspberry o en Render como dice el PRD? Solo quiero confirmar para efectos de la llamada `fetch` (si hay que usar un subproceso asíncrono o la acción serverless estándar es suficiente).
2. ¿Aceptas la convención de `iatutor_tv_config_[student_id]` como nombre para el canal público/privado de ntfy.sh? (Considerando que el `student_id` es un UUID indescifrable, asumiendo privacidad adecuada según NTFY free).

## Verification Plan

### Automated Tests
- Validar mediante el log de Termux que el `tv_network_listener.py` recibe el evento push instantáneamente.

### Manual Verification
1. Hacer un cambio de configuración en el Kiosco/Admin Dashboard de la web vinculada al SmartTV.
2. Comprobar que en menos de 2 segundos el archivo local en el móvil `~/tv_config.json` se actualiza.
3. Verificar la consola de log `~/tv_control.log` para confirmar que `watchdog` disparó el "reload" y el script aplicó las validaciones del televisor sin generar peticiones a Supabase.
