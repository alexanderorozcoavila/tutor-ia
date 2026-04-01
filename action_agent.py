"""
Agente de Menú del Sistema — IA Tutor
======================================
Servidor HTTP local en puerto 3001.
Recibe peticiones del frontend (vía proxy Next.js) para ejecutar
comandos del sistema operativo definidos en la base de datos.

Seguridad:
  - Solo acepta conexiones desde 127.0.0.1
  - Los comandos se recuperan de Supabase (nunca del cliente)
  - Comandos con sudo se ejecutan via sudoers sin contraseña

Configuración:
  - USUARIO_LINUX en .env.local (usuario que ejecuta los comandos)
  - Requiere entrada en /etc/sudoers.d/ia-tutor para comandos sudo

Uso:
  python3 action_agent.py
"""

import os
import sys
import json
import time
import signal
import logging
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

# Usuario Linux que ejecuta los comandos (configurable en .env.local)
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
USUARIO_LINUX = os.getenv("USUARIO_LINUX", "sergio")
RUTA_ENV     = os.path.join("/home", USUARIO_LINUX, "tutor-ia/.env.local")
load_dotenv(dotenv_path=RUTA_ENV)

# Sobrescribir desde .env si está definido
USUARIO_LINUX = os.getenv("USUARIO_LINUX", USUARIO_LINUX)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

AGENT_HOST   = "127.0.0.1"   # Solo localhost — nunca exponer al exterior
AGENT_PORT   = int(os.getenv("MENU_AGENT_PORT", "3001"))
HEARTBEAT_S  = 60            # segundos entre logs de heartbeat

# ─── LOGGING ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [menu-agent] %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger("menu-agent")

# ─── VALIDACIONES ─────────────────────────────────────────────────────────────
if not SUPABASE_URL or not SUPABASE_KEY:
    log.error(f"❌ Credenciales no encontradas en {RUTA_ENV}")
    sys.exit(1)

# ─── CLIENTE SUPABASE ─────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── FUNCIONES DE NEGOCIO ─────────────────────────────────────────────────────

def obtener_accion(accion_id: str) -> Optional[dict]:
    """Recupera una acción del sistema desde Supabase por su ID."""
    try:
        resp = supabase.table("menu_acciones") \
            .select("id, nombre, comando, requiere_sudo, activo") \
            .eq("id", accion_id) \
            .single() \
            .execute()
        return resp.data
    except Exception as e:
        log.error(f"Error consultando Supabase: {e}")
        return None


def ejecutar_comando(accion: dict) -> tuple[bool, str]:
    """
    Ejecuta el comando inyectando variables de entorno visuales
    para evitar errores de 'cannot open display'.
    """
    nombre    = accion.get("nombre", "?")
    comando   = accion.get("comando", "")
    con_sudo  = accion.get("requiere_sudo", False)

    if not accion.get("activo", True) or not comando:
        return False, "Acción inactiva o comando vacío"

    # 1. Definir el entorno visual (CRÍTICO para evitar tus errores de las fotos)
    # Esto le dice a Linux: "Usa el monitor 0 y los permisos de sergio"
    entorno_visual = f"DISPLAY=:0 XAUTHORITY=/home/{USUARIO_LINUX}/.Xauthority"

    # 2. Construir el comando final
    if con_sudo:
        # Para comandos de sistema (shutdown, reboot)
        cmd_final = f"sudo {comando}"
    else:
        # Para apps visuales (calculadora, terminal, logout)
        # Usamos '&' al final para que sea asíncrono y no bloquee el agente
        cmd_final = f"sudo -u {USUARIO_LINUX} {entorno_visual} {comando} &"

    log.info(f"▶ Ejecutando: [{nombre}] → {cmd_final}")

    try:
        # Usamos Popen en lugar de run para que sea asíncrono (no bloqueante)
        subprocess.Popen(
            cmd_final,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True # Desvincula el proceso del agente
        )
        
        log.info(f"✅ Disparado: [{nombre}]")
        return True, f"Acción {nombre} iniciada correctamente"

    except Exception as e:
        log.error(f"❌ Excepción ejecutando [{nombre}]: {e}")
        return False, str(e)


# ─── HANDLER HTTP ─────────────────────────────────────────────────────────────

class MenuHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Silenciar logs por defecto del HTTPServer (usamos nuestro logger)
        pass

    def _solo_localhost(self) -> bool:
        """Rechaza peticiones que no vienen de 127.0.0.1."""
        client_ip = self.client_address[0]
        if client_ip != "127.0.0.1":
            log.warning(f"🚫 Petición rechazada desde IP externa: {client_ip}")
            self._responder(403, {"error": "Acceso denegado"})
            return False
        return True

    def _responder(self, status: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if not self._solo_localhost():
            return
        if self.path == "/health":
            self._responder(200, {
                "status": "ok",
                "usuario": USUARIO_LINUX,
                "puerto": AGENT_PORT
            })
        else:
            self._responder(404, {"error": "Ruta no encontrada"})

    def do_POST(self):
        if not self._solo_localhost():
            return

        if self.path != "/ejecutar":
            self._responder(404, {"error": "Ruta no encontrada"})
            return

        # Leer body
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw    = self.rfile.read(length)
            body   = json.loads(raw)
        except Exception:
            self._responder(400, {"error": "Body JSON inválido"})
            return

        accion_id = body.get("accion_id", "").strip()
        if not accion_id:
            self._responder(400, {"error": "accion_id requerido"})
            return

        log.info(f"📥 Petición ejecutar | accion_id={accion_id}")

        # Recuperar acción desde BD
        accion = obtener_accion(accion_id)
        if not accion:
            self._responder(404, {"error": "Acción no encontrada o error de BD"})
            return

        # Ejecutar
        ok, mensaje = ejecutar_comando(accion)

        if ok:
            self._responder(200, {
                "ok": True,
                "accion": accion.get("nombre"),
                "mensaje": mensaje
            })
        else:
            self._responder(500, {
                "ok": False,
                "error": mensaje
            })


# ─── HEARTBEAT ────────────────────────────────────────────────────────────────

def heartbeat_loop():
    """Hilo que loguea periódicamente que el agente sigue activo."""
    while True:
        time.sleep(HEARTBEAT_S)
        log.info(f"💓 Heartbeat — Menu Agent activo en {AGENT_HOST}:{AGENT_PORT} | usuario={USUARIO_LINUX}")


# ─── SEÑALES ──────────────────────────────────────────────────────────────────

_server: Optional[HTTPServer] = None

def handle_exit(signum, frame):
    log.info("🛑 Menu Agent detenido.")
    if _server:
        _server.shutdown()
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_exit)
signal.signal(signal.SIGINT, handle_exit)

# ─── ARRANQUE ─────────────────────────────────────────────────────────────────

log.info("=" * 60)
log.info("🖥️  IA Tutor — Menu Agent")
log.info(f"   Escuchando: http://{AGENT_HOST}:{AGENT_PORT}")
log.info(f"   Usuario:    {USUARIO_LINUX}")
log.info(f"   .env:       {RUTA_ENV}")
log.info("=" * 60)

# Iniciar hilo de heartbeat
t = threading.Thread(target=heartbeat_loop, daemon=True)
t.start()

# Iniciar servidor HTTP
_server = HTTPServer((AGENT_HOST, AGENT_PORT), MenuHandler)
log.info(f"✅ Servidor listo. Esperando peticiones en /ejecutar y /health")
_server.serve_forever()
