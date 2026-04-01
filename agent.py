import os
import sys
import time
import signal
import logging
import subprocess
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

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

proceso_recompensa: Optional[subprocess.Popen] = None
proceso_kiosco_home: Optional[subprocess.Popen] = None

# ─── FUNCIONES DE CONTROL ─────────────────────────────────────────────────────

def lanzar_recompensa(recompensa: dict) -> Optional[subprocess.Popen]:
    tipo = recompensa.get("tipo", "url")
    nombre = recompensa.get("nombre", "Recompensa")
    cerrar_kiosco_home()

    if tipo == "url":
        url = recompensa.get("url", "")
        log.info(f"🎮 Abriendo recompensa '{nombre}': {url}")
        os.system("sudo ufw default allow outgoing > /dev/null 2>&1")
        # CORRECCIÓN: Usamos USUARIO_LINUX dinámico
        comando = f"sudo -u {USUARIO_LINUX} DISPLAY=:0 chromium-browser --kiosk --app={url}"
        return subprocess.Popen(comando, shell=True)
    return None

def abrir_kiosco_home():
    global proceso_kiosco_home
    if proceso_kiosco_home is not None: return
    log.info(f"🏠 Iniciando App Local: {KIOSCO_HOME_URL}")
    # CORRECCIÓN: Usamos USUARIO_LINUX dinámico
    cmd = f"sudo -u {USUARIO_LINUX} DISPLAY=:0 chromium-browser --kiosk --app={KIOSCO_HOME_URL}"
    proceso_kiosco_home = subprocess.Popen(cmd, shell=True)

def cerrar_recompensa():
    global proceso_recompensa
    if proceso_recompensa:
        log.info("🔒 Cerrando recompensa y bloqueando internet...")
        os.system("pkill -f 'chromium-browser --kiosk --app' > /dev/null 2>&1")
        os.system("sudo ufw default deny outgoing > /dev/null 2>&1")
        os.system("sudo ufw allow out to any port 443 > /dev/null 2>&1")
        proceso_recompensa = None

def cerrar_kiosco_home():
    global proceso_kiosco_home
    if proceso_kiosco_home:
        os.system(f"pkill -u {USUARIO_LINUX} chromium-browser > /dev/null 2>&1")
        proceso_kiosco_home = None

# ... (El resto del bucle While True se mantiene igual que tu original) ...

# ─── BUCLE PRINCIPAL (Simplificado para brevedad) ──────────────────────────────
abrir_kiosco_home()
while True:
    try:
        # Lógica de polling de Supabase (idéntica a la tuya)
        # ... (Aquí va tu bloque de lógica de 'obtener_estado' y 'decrementar_minuto')
        time.sleep(POLL_INTERVAL_IDLE)
    except Exception as e:
        log.error(f"Error: {e}")
        time.sleep(POLL_INTERVAL_IDLE)