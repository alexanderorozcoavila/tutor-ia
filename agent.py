import os
import sys
import time
import signal
import logging
import subprocess
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# ─── CONFIGURACIÓN DE USUARIO ──────────────────────────────────────────────────
# CAMBIA ESTO: Pon aquí el nombre de usuario que usas en tu Lenovo (ej: 'sergio')
USUARIO_LINUX = "sergio" 

# ─── CONFIGURACIÓN DE RUTA ────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Ruta al archivo .env.local (ajustada a tu estructura de carpetas)
RUTA_ENV = os.path.join("/home", USUARIO_LINUX, "tutor-ia/.env.local")
load_dotenv(dotenv_path=RUTA_ENV)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ALUMNO_ID    = os.getenv("ALUMNO_ID")

KIOSCO_HOME_URL = os.getenv("KIOSCO_HOME_URL", "http://localhost:3000")
POLL_INTERVAL_IDLE = 10
POLL_INTERVAL_ACTIVE = 60
LOG_HEARTBEAT_CADA = 6  # Cada 6 ciclos idle (60s) loguea "sigo vivo"

# ─── LOGGING ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("ia-tutor-agent")

# ─── VALIDACIONES ─────────────────────────────────────────────────────────────
if not SUPABASE_URL or not SUPABASE_KEY:
    log.error(f"❌ Error: No se encontraron credenciales en {RUTA_ENV}")
    sys.exit(1)

if not ALUMNO_ID:
    log.error("❌ Error: ALUMNO_ID no configurado en .env.local")
    sys.exit(1)

# ─── CLIENTE SUPABASE ─────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
proceso_recompensa: Optional[subprocess.Popen] = None
proceso_kiosco_home: Optional[subprocess.Popen] = None
minutos_usados_contador: int = 0
ciclos_idle: int = 0

# ─── FUNCIONES DE BASE DE DATOS ───────────────────────────────────────────────

def obtener_estado() -> Optional[dict]:
    """Lee control_dispositivo + recompensa JOIN desde Supabase."""
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
            "minutos_disponibles": nuevo_valor,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("alumno_id", ALUMNO_ID).execute()
        log.info(f"⏱  Tiempo restante: {nuevo_valor} minuto(s)")
    except Exception as e:
        log.error(f"Error al decrementar minutos: {e}")
    return nuevo_valor


def registrar_finalizacion(uso_recompensa_id: str, minutos_usados: int) -> None:
    """Marca el uso de recompensa como completado y resetea control_dispositivo."""
    try:
        supabase.table("uso_recompensa").update({
            "finalizado_at": datetime.utcnow().isoformat(),
            "minutos_usados": minutos_usados,
            "completado": True
        }).eq("id", uso_recompensa_id).execute()

        supabase.table("control_dispositivo").update({
            "estado": "bloqueado",
            "recompensa_id": None,
            "uso_recompensa_id": None,
            "minutos_disponibles": 0,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("alumno_id", ALUMNO_ID).execute()

        log.info(f"✅ Recompensa finalizada. Minutos usados: {minutos_usados}")
    except Exception as e:
        log.error(f"Error al registrar finalización: {e}")


# ─── FUNCIONES DE CONTROL DEL DISPOSITIVO ────────────────────────────────────

def lanzar_recompensa(recompensa: dict) -> Optional[subprocess.Popen]:
    tipo = recompensa.get("tipo", "url")
    nombre = recompensa.get("nombre", "Recompensa")
    cerrar_kiosco_home()

    if tipo == "url":
        url = recompensa.get("url", "")
        if not url:
            log.error("No hay URL definida en la recompensa.")
            return None
        log.info(f"🎮 Abriendo recompensa '{nombre}': {url}")
        os.system("sudo ufw default allow outgoing > /dev/null 2>&1")
        profile_dir = "/tmp/tutor_reward_isolated_session"
        os.system(f"rm -rf {profile_dir} > /dev/null 2>&1")
        comando = f"sudo -u {USUARIO_LINUX} DISPLAY=:0 chromium-browser --user-data-dir={profile_dir} --kiosk --app={url}"
        return subprocess.Popen(comando, shell=True)

    elif tipo == "comando":
        cmd = recompensa.get("comando", "")
        if not cmd:
            log.error("No hay comando definido en la recompensa.")
            return None
        log.info(f"⚙️  Ejecutando comando '{nombre}': {cmd}")
        return subprocess.Popen(f"sudo -u {USUARIO_LINUX} DISPLAY=:0 {cmd}", shell=True)

    log.error(f"Tipo de recompensa desconocido: {tipo}")
    return None


def abrir_kiosco_home():
    global proceso_kiosco_home
    if proceso_kiosco_home is not None:
        return
    log.info(f"🏠 Iniciando App Local: {KIOSCO_HOME_URL}")
    cmd = f"sudo -u {USUARIO_LINUX} DISPLAY=:0 chromium-browser --kiosk --app={KIOSCO_HOME_URL}"
    proceso_kiosco_home = subprocess.Popen(cmd, shell=True)


def cerrar_recompensa():
    global proceso_recompensa
    if proceso_recompensa:
        log.info("🔒 Cerrando recompensa y bloqueando internet...")
        os.system(f"sudo -u {USUARIO_LINUX} DISPLAY=:0 xdotool key Escape > /dev/null 2>&1")
        time.sleep(0.5)
        os.system("pkill -9 -f 'tutor_reward_isolated_session' > /dev/null 2>&1")
        os.system("sudo ufw default deny outgoing > /dev/null 2>&1")
        os.system("sudo ufw allow out to any port 443 > /dev/null 2>&1")
        os.system("sudo ufw allow out to any port 53 > /dev/null 2>&1")
        proceso_recompensa = None


def cerrar_kiosco_home():
    global proceso_kiosco_home
    if proceso_kiosco_home:
        os.system(f"pkill -u {USUARIO_LINUX} chromium-browser > /dev/null 2>&1")
        proceso_kiosco_home = None


def handle_exit(signum, frame):
    log.info("🛑 Agente detenido. Limpiando...")
    cerrar_recompensa()
    abrir_kiosco_home()
    sys.exit(0)


# ─── INICIO ──────────────────────────────────────────────────────────────────

signal.signal(signal.SIGTERM, handle_exit)
signal.signal(signal.SIGINT, handle_exit)

log.info("=" * 60)
log.info(f"🤖 Agente IA Tutor iniciado")
log.info(f"   Alumno: {ALUMNO_ID}")
log.info(f"   Kiosco: {KIOSCO_HOME_URL}")
log.info(f"   .env:   {RUTA_ENV}")
log.info(f"   Usuario Linux: {USUARIO_LINUX}")
log.info("=" * 60)

# ─── PASO 0: Verificar si hay recompensa activa pendiente (reanudación) ──────
log.info("🔍 Verificando si hay una recompensa activa pendiente (reanudación tras reinicio)...")
estado_inicial = obtener_estado()

if estado_inicial and estado_inicial.get("estado") == "activo" and estado_inicial.get("minutos_disponibles", 0) > 0:
    recompensa_pendiente = estado_inicial.get("recompensa")
    minutos_rest = estado_inicial.get("minutos_disponibles", 0)
    uso_id = estado_inicial.get("uso_recompensa_id")
    nombre = recompensa_pendiente.get("nombre", "?") if recompensa_pendiente else "?"

    log.info(f"🔄 ¡Recompensa pendiente encontrada! '{nombre}' con {minutos_rest} min restantes. Reanudando...")
    proceso_recompensa = lanzar_recompensa(recompensa_pendiente)
    minutos_usados_contador = 0  # los minutos previos ya se descontaron en BD
else:
    log.info("✔  No hay recompensa pendiente. Modo normal.")
    abrir_kiosco_home()


# ─── BUCLE PRINCIPAL ──────────────────────────────────────────────────────────

while True:
    try:
        estado = obtener_estado()

        if not estado:
            ciclos_idle += 1
            if ciclos_idle % LOG_HEARTBEAT_CADA == 0:
                log.info(f"💓 Heartbeat — Agente activo. Sin registro en control_dispositivo. ({ciclos_idle} ciclos)")
            time.sleep(POLL_INTERVAL_IDLE)
            continue

        esta_activo       = estado.get("estado") == "activo"
        minutos_disp      = estado.get("minutos_disponibles", 0)
        uso_recompensa_id = estado.get("uso_recompensa_id")
        recompensa        = estado.get("recompensa")

        # ── CASO A: Recompensa activa con tiempo disponible ────────────────
        if esta_activo and minutos_disp > 0 and recompensa:
            ciclos_idle = 0

            if proceso_recompensa is None:
                # Primera vez o reanudación
                log.info(f"🚀 Activando recompensa: {recompensa.get('nombre', '?')} — {minutos_disp} min")
                proceso_recompensa = lanzar_recompensa(recompensa)
                minutos_usados_contador = 0

            # Esperar 1 minuto y descontar
            time.sleep(POLL_INTERVAL_ACTIVE)
            minutos_usados_contador += 1
            minutos_disp = decrementar_minuto(minutos_disp)

        # ── CASO B: Tiempo agotado o estado bloqueado ──────────────────────
        else:
            if proceso_recompensa is not None:
                log.info(f"⏰ Recompensa terminada. Minutos usados en esta sesión: {minutos_usados_contador}")
                cerrar_recompensa()

                if uso_recompensa_id:
                    registrar_finalizacion(uso_recompensa_id, minutos_usados_contador)

                minutos_usados_contador = 0
                time.sleep(2)
                abrir_kiosco_home()

            # Modo idle: heartbeat periódico
            ciclos_idle += 1
            if ciclos_idle % LOG_HEARTBEAT_CADA == 0:
                log.info(f"💓 Heartbeat — Agente activo. Estado: bloqueado. Esperando activación. ({ciclos_idle} ciclos, ~{ciclos_idle * POLL_INTERVAL_IDLE}s)")
            time.sleep(POLL_INTERVAL_IDLE)

    except KeyboardInterrupt:
        handle_exit(None, None)
    except Exception as e:
        log.error(f"❌ Error en ciclo principal: {e}")
        time.sleep(POLL_INTERVAL_IDLE)