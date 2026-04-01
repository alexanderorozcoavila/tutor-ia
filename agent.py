"""
Agente IA Tutor — Controlador de Recompensas en Dispositivo Kiosco
==================================================================
Descripción:
    Consulta la tabla `control_dispositivo` en Supabase para saber cuándo
    se ha activado una recompensa. Si hay una recompensa activa, lanza la
    app (URL en kiosco o comando nativo), cuenta el tiempo disponible,
    y al finalizar cierra todo y vuelve al kiosco principal del alumno.

Configuración:
    - Variables de entorno en /home/alumno/ia-tutor/.env.local
    - ALUMNO_ID puede sobreescribirse con variable de entorno ALUMNO_ID

Uso:
    python3 agent.py
    ALUMNO_ID="uuid-del-alumno" python3 agent.py
"""

import os
import sys
import time
import signal
import logging
import subprocess
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

# Ruta al archivo .env.local (por defecto junto al script)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RUTA_ENV = os.getenv("ENV_PATH", os.path.join(SCRIPT_DIR, ".env.local"))
load_dotenv(dotenv_path=RUTA_ENV)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ALUMNO_ID    = os.getenv("ALUMNO_ID")

# URL de la plataforma educativa (kiosco principal al que volver)
KIOSCO_HOME_URL = os.getenv("KIOSCO_HOME_URL", "http://localhost:3000")

# Intervalo de polling en segundos cuando no hay recompensa activa
POLL_INTERVAL_IDLE = 10

# Intervalo de countdown activo (cada 60 segundos se descuenta 1 minuto)
POLL_INTERVAL_ACTIVE = 60

# ─── LOGGING ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/var/log/ia-tutor-agent.log", mode="a") if os.path.exists("/var/log") else logging.StreamHandler()
    ]
)
log = logging.getLogger("ia-tutor-agent")

# ─── VALIDACIONES INICIALES ───────────────────────────────────────────────────
if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("❌ Error: No se encontraron las credenciales en el archivo .env.local")
    sys.exit(1)

if not ALUMNO_ID:
    log.error("❌ Error: ALUMNO_ID no configurado. Agrégalo en .env.local o como variable de entorno.")
    log.error(f"   Archivo .env.local buscado en: {RUTA_ENV}")
    sys.exit(1)

# ─── CLIENTE SUPABASE ─────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
proceso_recompensa: Optional[subprocess.Popen] = None
proceso_kiosco_home: Optional[subprocess.Popen] = None
minutos_usados_contador: int = 0

# ─── FUNCIONES DE CONTROL DEL DISPOSITIVO ────────────────────────────────────


def obtener_estado() -> Optional[dict]:
    """Lee control_dispositivo + recompensas JOIN desde Supabase."""
    try:
        resp = supabase.table("control_dispositivo") \
            .select("*, recompensa:recompensas(*)") \
            .eq("alumno_id", ALUMNO_ID) \
            .single() \
            .execute()
        return resp.data
    except Exception as e:
        log.error(f"Error al leer control_dispositivo: {e}")
        return None


def decrementar_minuto(minutos_actuales: int) -> int:
    """Resta 1 minuto al contador en la BD y retorna el nuevo valor."""
    nuevo_valor = max(0, minutos_actuales - 1)
    try:
        supabase.table("control_dispositivo").update({
            "minutos_disponibles": nuevo_valor
        }).eq("alumno_id", ALUMNO_ID).execute()
        log.info(f"⏱  Tiempo restante: {nuevo_valor} minuto(s)")
    except Exception as e:
        log.error(f"Error al decrementar minutos: {e}")
    return nuevo_valor


def registrar_finalizacion(uso_recompensa_id: str, minutos_usados: int) -> None:
    """Marca el uso de recompensa como completado y resetea control_dispositivo."""
    try:
        # 1. Actualizar registro de uso
        supabase.table("uso_recompensa").update({
            "finalizado_at": "now()",
            "minutos_usados": minutos_usados,
            "completado": True
        }).eq("id", uso_recompensa_id).execute()

        # 2. Resetear control del dispositivo
        supabase.table("control_dispositivo").update({
            "estado": "bloqueado",
            "recompensa_id": None,
            "uso_recompensa_id": None,
            "minutos_disponibles": 0,
            "updated_at": "now()"
        }).eq("alumno_id", ALUMNO_ID).execute()

        log.info(f"✅ Recompensa finalizada. Minutos usados: {minutos_usados}")
    except Exception as e:
        log.error(f"Error al registrar finalización: {e}")


def lanzar_recompensa(recompensa: dict) -> Optional[subprocess.Popen]:
    """Lanza la recompensa según su tipo (url o comando)."""
    tipo = recompensa.get("tipo", "url")
    nombre = recompensa.get("nombre", "Recompensa")

    # Primero bloquear escritorio propio si existe kiosco home
    cerrar_kiosco_home()

    if tipo == "url":
        url = recompensa.get("url", "")
        if not url:
            log.error("No hay URL definida en la recompensa.")
            return None
        log.info(f"🎮 Abriendo recompensa '{nombre}' en kiosco: {url}")
        # Abrir internet en el firewall
        os.system("sudo ufw default allow outgoing 2>/dev/null || true")
        comando = f"sudo -u alumno DISPLAY=:0 chromium-browser --kiosk --app={url} --no-first-run --disable-pinch --overscroll-history-navigation=0"
        return subprocess.Popen(comando, shell=True)

    elif tipo == "comando":
        cmd = recompensa.get("comando", "")
        if not cmd:
            log.error("No hay comando definido en la recompensa.")
            return None
        log.info(f"⚙️  Ejecutando comando de recompensa '{nombre}': {cmd}")
        return subprocess.Popen(f"sudo -u alumno DISPLAY=:0 {cmd}", shell=True)

    else:
        log.error(f"Tipo de recompensa desconocido: {tipo}")
        return None


def cerrar_recompensa() -> None:
    """Cierra el proceso de la recompensa de forma limpia."""
    global proceso_recompensa
    if proceso_recompensa is not None:
        log.info("🔒 Cerrando aplicación de recompensa...")
        try:
            # Matar el navegador kiosco de la recompensa
            os.system("pkill -f 'chromium-browser --kiosk --app' 2>/dev/null || true")
            proceso_recompensa.terminate()
            proceso_recompensa.wait(timeout=5)
        except Exception:
            pass
        proceso_recompensa = None

        # Volver a restringir internet
        os.system("sudo ufw default deny outgoing 2>/dev/null || true")
        os.system("sudo ufw allow out to any port 443 2>/dev/null || true")
        os.system("sudo ufw allow out to any port 53 2>/dev/null || true")


def abrir_kiosco_home() -> Optional[subprocess.Popen]:
    """Abre el kiosco de la plataforma educativa principal."""
    global proceso_kiosco_home
    if proceso_kiosco_home is not None:
        return proceso_kiosco_home  # Ya está abierto
    log.info(f"🏠 Volviendo al kiosco principal: {KIOSCO_HOME_URL}")
    cmd = f"sudo -u alumno DISPLAY=:0 chromium-browser --kiosk --app={KIOSCO_HOME_URL} --no-first-run"
    proceso_kiosco_home = subprocess.Popen(cmd, shell=True)
    return proceso_kiosco_home


def cerrar_kiosco_home() -> None:
    """Cierra el kiosco de la plataforma principal."""
    global proceso_kiosco_home
    if proceso_kiosco_home is not None:
        try:
            proceso_kiosco_home.terminate()
            proceso_kiosco_home.wait(timeout=5)
        except Exception:
            pass
        proceso_kiosco_home = None


def handle_exit(signum, frame):
    """Limpieza al terminar el agente (SIGTERM/SIGINT)."""
    log.info("🛑 Agente detenido. Limpiando procesos...")
    cerrar_recompensa()
    abrir_kiosco_home()
    sys.exit(0)


# ─── BUCLE PRINCIPAL ──────────────────────────────────────────────────────────

signal.signal(signal.SIGTERM, handle_exit)
signal.signal(signal.SIGINT, handle_exit)

log.info("=" * 60)
log.info(f"🤖 Agente IA Tutor iniciado | Alumno: {ALUMNO_ID}")
log.info(f"🏠 Kiosco home: {KIOSCO_HOME_URL}")
log.info("=" * 60)

# Iniciar kiosco home al arrancar el agente
abrir_kiosco_home()

while True:
    try:
        estado = obtener_estado()

        if not estado:
            # No hay registro aún, esperar
            time.sleep(POLL_INTERVAL_IDLE)
            continue

        esta_activo        = estado.get("estado") == "activo"
        minutos_disp       = estado.get("minutos_disponibles", 0)
        uso_recompensa_id  = estado.get("uso_recompensa_id")
        recompensa         = estado.get("recompensa")  # JOIN desde recompensas

        # ── CASO A: Recompensa activa con tiempo disponible ────────────────
        if esta_activo and minutos_disp > 0 and recompensa:
            if proceso_recompensa is None:
                # Primera vez: lanzar la app
                proceso_recompensa = lanzar_recompensa(recompensa)
                minutos_usados_contador = 0

            # Esperar 1 minuto y descontar
            time.sleep(POLL_INTERVAL_ACTIVE)
            minutos_usados_contador += 1
            minutos_disp = decrementar_minuto(minutos_disp)

        # ── CASO B: Tiempo agotado o estado bloqueado ──────────────────────
        else:
            if proceso_recompensa is not None:
                # Había una recompensa activa, cerrarla
                log.info(f"⏰ Tiempo agotado. Minutos usados: {minutos_usados_contador}")
                cerrar_recompensa()

                # Registrar en BD
                if uso_recompensa_id:
                    registrar_finalizacion(uso_recompensa_id, minutos_usados_contador)

                minutos_usados_contador = 0

                # Volver al kiosco principal
                time.sleep(2)
                abrir_kiosco_home()

            # Modo idle: esperar próxima activación
            time.sleep(POLL_INTERVAL_IDLE)

    except KeyboardInterrupt:
        handle_exit(None, None)
    except Exception as e:
        log.error(f"❌ Error en el ciclo principal: {e}")
        time.sleep(POLL_INTERVAL_IDLE)