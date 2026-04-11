Aquí tienes el PRD (Documento de Requisitos del Producto) estructurado para el desarrollo, incorporando la lógica de prioridad y la integración con Supabase. Al tener un perfil técnico, he orientado el documento directamente hacia la arquitectura, modelo de datos y reglas de negocio.

---

## PRD: Sistema de Control Parental Activo para Smart TV (v1.0)

### 1. Resumen Ejecutivo
Un servicio que se ejecuta en segundo plano en un dispositivo Android, diseñado para monitorear y controlar el estado de encendido de un Smart TV Samsung en la red local. El sistema determina si el televisor debe estar apagado basándose en una configuración remota alojada en Supabase, la cual permite bloqueos por franja horaria o mediante una orden manual directa que tiene máxima prioridad.

### 2. Arquitectura del Sistema
El sistema se compone de tres nodos principales:
* **Backend / Panel de Control:** Proyecto en Supabase (PostgreSQL + API REST/Realtime) que almacena la configuración y el estado deseado.
* **Cliente / Worker (Android):** Script en Python ejecutándose de forma continua y silenciosa bajo Termux, que actúa como puente entre la base de datos en la nube y la red local.
* **Dispositivo Objetivo:** Smart TV Samsung controlada mediante *Websockets* locales (API puerto 8002).

### 3. Modelo de Datos (Supabase)
Necesitas una tabla en Supabase, por ejemplo `tv_config`, para almacenar los parámetros.

**Esquema de la tabla `tv_config`**:
* `id` (uuid, Primary Key)
* `device_ip` (text): Dirección IP local del televisor (ej. '192.168.1.100').
* `force_power_off` (boolean): Bandera para bloqueo manual. Prioridad absoluta. `true` = Apagar siempre.
* `restricted_start_time` (time): Hora de inicio del bloqueo (ej. '22:00:00').
* `restricted_end_time` (time): Hora de fin del bloqueo (ej. '08:00:00').
* `is_active` (boolean): Activa o desactiva la evaluación de las reglas (Master switch).

### 4. Reglas de Negocio y Lógica de Decisión (El "Cerebro")
El script en Python evaluará el estado basándose en el siguiente árbol de decisión, ejecutado en cada iteración del bucle:

1.  **Petición HTTP:** Consultar el registro activo en Supabase. Si hay error de conexión a internet, el script entra en pausa y reintenta en el próximo ciclo (fail-safe).
2.  **Evaluación Master:** ¿`is_active` es `true`? Si es `false`, se omite el ciclo.
3.  **Evaluación de Prioridad 1 (Orden Directa):**
    * Si `force_power_off` == `true` $\rightarrow$ El estado objetivo es **BLOQUEADO**.
4.  **Evaluación de Prioridad 2 (Horario):**
    * Si `force_power_off` == `false`, se compara la hora actual del sistema (`datetime.now().time()`) con `restricted_start_time` y `restricted_end_time`.
    * Manejo de horario cruzado: Si la hora de inicio es mayor que la hora de fin (ej. 22:00 a 08:00, cruza la medianoche), la lógica debe evaluar correctamente `hora_actual >= inicio OR hora_actual <= fin`.
    * Si está dentro del rango $\rightarrow$ El estado objetivo es **BLOQUEADO**.
5.  **Acción Local (Si el estado es BLOQUEADO):**
    * Ejecutar `ping` a `device_ip`.
    * Si el ping responde (TV encendida), instanciar `SamsungTVWS` y enviar comando `power`.

### 5. Requisitos Funcionales (RF)
* **RF1:** El sistema debe poder leer datos de Supabase vía REST API (usando la librería `supabase` de Python o `requests`).
* **RF2:** El comando manual (`force_power_off`) debe anular y tener precedencia sobre cualquier franja horaria establecida.
* **RF3:** El script debe ejecutarse de forma perpetua mientras el dispositivo móvil esté encendido, iniciándose automáticamente en el arranque (Termux:Boot).
* **RF4:** El sistema debe interactuar con la TV a nivel de LAN sin requerir que la TV tenga salida a internet para el comando de apagado.

### 6. Requisitos No Funcionales (RNF)
* **RNF1 (Bajo consumo):** Para preservar la batería del smartphone, las peticiones a Supabase y los pings locales deben tener un intervalo de al menos 30 a 60 segundos entre ejecuciones (`time.sleep()`).
* **RNF2 (Tolerancia a fallos):** El script debe contener bloques `try-except` integrales para evitar que el proceso se caiga por un *TimeOut* de Supabase o una desconexión abrupta del websocket de la TV.
* **RNF3 (Seguridad):** Las credenciales de Supabase (`SUPABASE_URL` y `SUPABASE_KEY`) deben manejarse como variables de entorno en Termux, no expuestas (hardcoded) en el texto del script.

### 7. Fragmento de Lógica Actualizada (Python pseudo-código)

Para integrar esto, tu nuevo script reemplazará la función estática de tiempo por una consulta dinámica:

```python
import os
import time
from datetime import datetime
from supabase import create_client, Client
from samsungtvws import SamsungTVWS

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def should_tv_be_off(config):
    # Prioridad 1: Orden de bloqueo manual
    if config.get('force_power_off') is True:
        return True
    
    # Prioridad 2: Validación de horario
    now = datetime.now().time()
    start_str = config.get('restricted_start_time')
    end_str = config.get('restricted_end_time')
    
    if start_str and end_str:
        start_time = datetime.strptime(start_str, '%H:%M:%S').time()
        end_time = datetime.strptime(end_str, '%H:%M:%S').time()
        
        if start_time < end_time:
            return start_time <= now <= end_time
        else: # Cruza la medianoche
            return now >= start_time or now <= end_time
            
    return False

# Bucle principal omitido por brevedad (mantiene la lógica del Ping descrita en el PRD)
```

Con este PRD, tienes la base arquitectónica exacta. Posteriormente puedes desarrollar una pequeña interfaz web simple u otra app móvil que actualice esos valores en Supabase, sirviendo como tu control remoto maestro.