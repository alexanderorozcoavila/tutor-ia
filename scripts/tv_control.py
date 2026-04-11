#!/usr/bin/env python3
"""
tv_control.py — Control Parental Smart TV Samsung
Sistema: IA Tutor (ia-tutor)

Worker que corre en Termux (Android). Lee la configuración de un alumno
desde Supabase via REST API y controla el televisor Samsung.

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
from datetime import datetime, timedelta
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

# ── Estado interno (evita spam de alertas) ─────────────────────────────
# Guarda la "marca de inicio de advertencia" ya disparada para no repetirla.
_warning_sent_for_start: str | None = None


# ══════════════════════════════════════════════════════════════════════
# Consulta a Supabase vía REST (PostgREST) — sin librería supabase-py
# ══════════════════════════════════════════════════════════════════════

def fetch_config() -> dict | None:
    """Lee tv_config del alumno. Retorna None si hay error de red."""
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
        return None  # fail-safe: sin internet → no actuar


# ══════════════════════════════════════════════════════════════════════
# Lógica de negocio
# ══════════════════════════════════════════════════════════════════════

def should_tv_be_off(config: dict) -> bool:
    """
    Árbol de decisión del PRD:
      Prioridad 1: force_power_off — anula todo.
      Prioridad 2: horario de bloqueo con soporte de cruce de medianoche.
    """
    if not config.get("is_active", True):
        return False

    if config.get("force_power_off", False):
        log.debug("Regla: force_power_off=true")
        return True

    start_str = config.get("restricted_start_time")
    end_str   = config.get("restricted_end_time")

    if start_str and end_str:
        now   = datetime.now().time()
        start = datetime.strptime(start_str[:5], "%H:%M").time()
        end_t = datetime.strptime(end_str[:5],   "%H:%M").time()
        in_range = (start <= now <= end_t) if start < end_t else (now >= start or now <= end_t)
        if in_range:
            log.debug(f"Regla: horario {start_str[:5]} → {end_str[:5]}")
            return True

    return False


def minutes_until_block_start(config: dict) -> float | None:
    """
    Retorna los minutos hasta que comience el bloqueo horario.
    Retorna None si no hay horario configurado o ya está en bloqueo.
    Retorna un valor negativo si ya pasó del inicio (en bloqueo activo).
    """
    start_str = config.get("restricted_start_time")
    end_str   = config.get("restricted_end_time")
    if not start_str or not end_str:
        return None

    now_dt    = datetime.now()
    start     = datetime.strptime(start_str[:5], "%H:%M").replace(
        year=now_dt.year, month=now_dt.month, day=now_dt.day
    )

    # Si la hora de inicio ya pasó hoy, apuntamos a mañana
    if start <= now_dt:
        start += timedelta(days=1)

    return (start - now_dt).total_seconds() / 60


def should_send_warning(config: dict) -> bool:
    """
    Retorna True si es el momento de enviar la alerta previa:
    - warning_minutes_before > 0
    - Hay horario configurado
    - Estamos dentro de la ventana de advertencia
    - No enviamos ya la alerta para este inicio de bloqueo
    """
    global _warning_sent_for_start

    warn_min = config.get("warning_minutes_before", 0)
    if not warn_min or warn_min <= 0:
        return False

    msg = config.get("warning_message", "").strip()
    if not msg:
        return False

    start_str = config.get("restricted_start_time")
    if not start_str:
        return False

    mins_left = minutes_until_block_start(config)
    if mins_left is None:
        return False

    # Ventana: entre warn_min y warn_min-1 minutos antes del inicio
    in_window = 0 < mins_left <= warn_min

    if in_window and _warning_sent_for_start != start_str:
        return True

    # Resetear el flag si ya pasó el horario (nueva vuelta del día)
    if mins_left > warn_min:
        _warning_sent_for_start = None

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


def send_warning(ip: str, message: str) -> bool:
    """
    Envía una notificación Toast a la Samsung TV usando send_broadcast.
    Aparece en pantalla durante ~10 segundos en la esquina superior derecha.
    """
    try:
        tv = SamsungTVWS(host=ip, port=8002, timeout=5)
        tv.open()
        tv.send_broadcast(message)
        tv.close()
        return True
    except Exception as e:
        log.warning(f"No se pudo enviar alerta a {ip}: {e}")
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
        log.warning(f"No se pudo enviar apagado a {ip}: {e}")
        return False


# ══════════════════════════════════════════════════════════════════════
# Bucle principal
# ══════════════════════════════════════════════════════════════════════

def main() -> None:
    global _warning_sent_for_start
    log.info(f"▶ tv_control iniciado — alumno: {STUDENT_ID} — intervalo: {POLL_INTERVAL}s")

    while True:
        try:
            config = fetch_config()

            if config is None:
                log.warning("Sin configuración. Reintentando en el próximo ciclo.")

            elif not config.get("is_active", True):
                log.debug("Sistema inactivo (is_active=false). Sin acción.")

            else:
                ip = config.get("device_ip", "")

                # ── Alerta previa ─────────────────────────────────────
                if should_send_warning(config) and ip:
                    msg  = config.get("warning_message", "¡La TV se apagará pronto!")
                    mins = config.get("warning_minutes_before", 5)
                    if is_tv_on(ip):
                        ok = send_warning(ip, msg)
                        if ok:
                            log.info(f"🔔 Alerta enviada a {ip} ({mins} min antes): {msg!r}")
                            _warning_sent_for_start = config.get("restricted_start_time")
                        else:
                            log.warning(f"⚠ Fallo al enviar alerta a {ip}")

                # ── Apagado ───────────────────────────────────────────
                if should_tv_be_off(config):
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
