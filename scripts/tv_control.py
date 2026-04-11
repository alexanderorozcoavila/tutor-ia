#!/usr/bin/env python3
"""
tv_control.py — Control Parental Smart TV Samsung
Sistema: IA Tutor (ia-tutor)

Worker que corre en Termux (Android). Lee la configuración de un alumno
desde Supabase via REST API (sin librería supabase-py, solo requests)
y apaga el televisor Samsung si corresponde.

Variables de entorno (~/.env):
  SUPABASE_URL              → valor de NEXT_PUBLIC_SUPABASE_URL del proyecto
  SUPABASE_SERVICE_ROLE_KEY → valor de SUPABASE_SERVICE_ROLE_KEY del proyecto
  STUDENT_ID                → UUID del alumno a monitorear
  POLL_INTERVAL_SECONDS     → intervalo de consulta (default: 45)
"""

import os
import time
import subprocess
import logging
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler

import requests
from dotenv import load_dotenv

# ── Samsung TV WS ──────────────────────────────────────────────────────
try:
    from samsungtvws import SamsungTVWS
except ImportError:
    raise SystemExit("❌ Falta 'samsungtvws'. Ejecuta: pip install samsungtvws")

# ── Configuración ──────────────────────────────────────────────────────
load_dotenv(os.path.expanduser("~/.env"))

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STUDENT_ID: str   = os.environ.get("STUDENT_ID", "")
POLL_INTERVAL: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "45"))

if not all([SUPABASE_URL, SUPABASE_KEY, STUDENT_ID]):
    raise SystemExit(
        "❌ Faltan variables de entorno.\n"
        "   Asegúrate de que ~/.env contiene:\n"
        "   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y STUDENT_ID."
    )

# Cabeceras PostgREST — idénticas a las que usa el frontend Next.js
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# ── Logging ────────────────────────────────────────────────────────────
log_path = os.path.expanduser("~/tv_control.log")
handler = TimedRotatingFileHandler(log_path, when="W0", backupCount=4)
handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"
))
logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()])
log = logging.getLogger("tv_control")


# ══════════════════════════════════════════════════════════════════════
# Consulta a Supabase vía REST (PostgREST)
# ══════════════════════════════════════════════════════════════════════

def fetch_config() -> dict | None:
    """
    Consulta tv_config del alumno usando la API REST de Supabase.
    Retorna la fila como dict, o None si hay error de red / sin datos.
    """
    endpoint = (
        f"{SUPABASE_URL}/rest/v1/tv_config"
        f"?student_id=eq.{STUDENT_ID}&select=*&limit=1"
    )
    try:
        resp = requests.get(endpoint, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data[0] if data else None
    except requests.exceptions.RequestException as e:
        log.warning(f"Error consultando Supabase: {e}")
        return None  # fail-safe: si no hay internet, no hacer nada


# ══════════════════════════════════════════════════════════════════════
# Lógica de negocio (árbol de decisión del PRD)
# ══════════════════════════════════════════════════════════════════════

def should_tv_be_off(config: dict) -> bool:
    """
    Prioridad 1: force_power_off (apagado manual) — anula todo.
    Prioridad 2: horario de bloqueo — con soporte de cruce de medianoche.
    """
    if not config.get("is_active", True):
        return False  # Master switch OFF

    # Prioridad 1 — Orden directa del administrador
    if config.get("force_power_off", False):
        log.debug("Regla: force_power_off=true")
        return True

    # Prioridad 2 — Evaluación de horario
    start_str = config.get("restricted_start_time")
    end_str   = config.get("restricted_end_time")

    if start_str and end_str:
        now   = datetime.now().time()
        start = datetime.strptime(start_str[:5], "%H:%M").time()
        end_t = datetime.strptime(end_str[:5],   "%H:%M").time()

        if start < end_t:
            in_range = start <= now <= end_t          # rango normal
        else:
            in_range = now >= start or now <= end_t   # cruza medianoche

        if in_range:
            log.debug(f"Regla: horario {start_str[:5]} → {end_str[:5]}")
            return True

    return False


def is_tv_on(ip: str) -> bool:
    """Ping a la IP del televisor. True = TV encendida."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", ip],
            capture_output=True, timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


def send_power_off(ip: str) -> bool:
    """Envía comando de apagado por WebSocket (puerto 8002) al Samsung TV."""
    try:
        tv = SamsungTVWS(host=ip, port=8002, timeout=5)
        tv.open()
        tv.shortcuts().power()
        tv.close()
        return True
    except Exception as e:
        log.warning(f"No se pudo enviar WebSocket a {ip}: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════
# Bucle principal
# ══════════════════════════════════════════════════════════════════════

def main() -> None:
    log.info(f"▶ tv_control iniciado — alumno: {STUDENT_ID} — intervalo: {POLL_INTERVAL}s")

    while True:
        try:
            config = fetch_config()

            if config is None:
                log.warning("Sin configuración. Reintentando en el próximo ciclo.")
            elif should_tv_be_off(config):
                ip = config.get("device_ip", "")
                if not ip:
                    log.warning("device_ip vacío, omitiendo.")
                elif is_tv_on(ip):
                    ok = send_power_off(ip)
                    if ok:
                        log.info(f"✅ Comando de apagado enviado a {ip}")
                    else:
                        log.warning(f"⚠ Fallo al apagar TV en {ip}")
                else:
                    log.debug(f"TV en {ip} ya está apagada o no responde al ping.")
            else:
                log.debug("TV dentro del horario permitido. Sin acción.")

        except Exception as e:
            log.error(f"Error inesperado en ciclo principal: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
