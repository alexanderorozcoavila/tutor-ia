#!/usr/bin/env python3
"""
tv_control.py — Control Parental Smart TV Samsung (Script B)
Sistema: IA Tutor (ia-tutor)

Worker que corre en Termux (Android). Lee la configuración de un alumno
desde un archivo local tv_config.json y controla el televisor Samsung.
Utiliza watchdog para reaccionar a cambios del archivo instantáneamente.
"""

import os
import time
import subprocess
import logging
import json
from datetime import datetime, timedelta
from logging.handlers import TimedRotatingFileHandler

from dotenv import load_dotenv

# ── Samsung TV WS ──────────────────────────────────────────────────────
try:
    from samsungtvws import SamsungTVWS
except ImportError:
    raise SystemExit("❌ Falta 'samsungtvws'. Ejecuta: pip install samsungtvws")

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    raise SystemExit("❌ Falta 'watchdog'. Ejecuta: pip install watchdog")

# ── Configuración ──────────────────────────────────────────────────────
load_dotenv(os.path.expanduser("~/.env"))

STUDENT_ID: str   = os.environ.get("STUDENT_ID", "")
POLL_INTERVAL: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "45"))

# URL de la webapp Next.js accesible desde la red local
WEBAPP_URL: str = os.environ.get("WEBAPP_URL", "http://192.168.1.86:3000").rstrip("/")
TOKEN_PATH = os.path.expanduser("~/tv_token.txt")
CONFIG_PATH = os.path.expanduser("~/tv_config.json")

if not STUDENT_ID:
    raise SystemExit("❌ Falta STUDENT_ID en ~/.env")

# ── Logging ────────────────────────────────────────────────────────────
log_path = os.path.expanduser("~/tv_control.log")
handler = TimedRotatingFileHandler(log_path, when="W0", backupCount=4)
handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"
))
logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()])
log = logging.getLogger("tv_control")

# ── Estado interno ─────────────────────────────────────────────────────
_warning_sent_for_start: str | None = None
global_config: dict | None = None

# ══════════════════════════════════════════════════════════════════════
# Manejo de Configuración Local (Watchdog)
# ══════════════════════════════════════════════════════════════════════

def load_local_config():
    """Lee tv_config.json en memoria."""
    global global_config
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                global_config = json.load(f)
                is_active = global_config.get("is_active", True)
                force_off = global_config.get("force_power_off", False)
                start = global_config.get("restricted_start_time", "N/A")
                end = global_config.get("restricted_end_time", "N/A")
                log.info(f"Configuración cargada: [Activo: {is_active}] [Forzar Apagado: {force_off}] [Horario: {start} - {end}]")
        except Exception as e:
            log.warning(f"Error leyendo {CONFIG_PATH}: {e}")
    else:
        log.warning(f"No existe {CONFIG_PATH} aún. Esperando actualización...")

class ConfigHandler(FileSystemEventHandler):
    def on_any_event(self, event):
        # os.replace típicamente genera un FileMovedEvent (con dest_path) o FileModifiedEvent
        path = getattr(event, 'dest_path', event.src_path)
        if path == CONFIG_PATH and not event.is_directory:
            log.info(f"💡 Evento de sistema detectado: {event.event_type} en tv_config.json")
            load_local_config()

# ══════════════════════════════════════════════════════════════════════
# Lógica de negocio
# ══════════════════════════════════════════════════════════════════════

def should_tv_be_off(config: dict) -> bool:
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
    start_str = config.get("restricted_start_time")
    end_str   = config.get("restricted_end_time")
    if not start_str or not end_str:
        return None
    now_dt    = datetime.now()
    start     = datetime.strptime(start_str[:5], "%H:%M").replace(
        year=now_dt.year, month=now_dt.month, day=now_dt.day
    )
    if start <= now_dt:
        start += timedelta(days=1)
    return (start - now_dt).total_seconds() / 60

def should_send_warning(config: dict) -> bool:
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
    in_window = 0 < mins_left <= warn_min
    if in_window and _warning_sent_for_start != start_str:
        return True
    if mins_left > warn_min:
        _warning_sent_for_start = None
    return False

def is_tv_on(ip: str) -> bool:
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", ip],
            capture_output=True, timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False

def send_warning(ip: str, message: str, minutes: int) -> bool:
    try:
        from urllib.parse import quote
        warning_url = f"{WEBAPP_URL}/api/tv-warning?msg={quote(message)}&min={minutes}"
        tv = SamsungTVWS(host=ip, port=8002, timeout=5, name='IAtutor', token_file=TOKEN_PATH)
        tv.open()
        tv.open_browser(warning_url)
        tv.close()
        return True
    except Exception as e:
        log.warning(f"No se pudo enviar alerta a {ip}: {e}")
        return False

def send_power_off(ip: str) -> bool:
    try:
        tv = SamsungTVWS(host=ip, port=8002, timeout=5, name='IAtutor', token_file=TOKEN_PATH)
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
    global _warning_sent_for_start, global_config
    log.info(f"▶ tv_control iniciado — alumno: {STUDENT_ID} — intervalo local: {POLL_INTERVAL}s")

    # Carga inicial
    load_local_config()

    # Configurar Watchdog
    event_handler = ConfigHandler()
    observer = Observer()
    config_dir = os.path.dirname(CONFIG_PATH) or "."
    observer.schedule(event_handler, path=config_dir, recursive=False)
    observer.start()

    try:
        while True:
            config = global_config

            if config is None:
                log.debug("Sin configuración local aún.")
            elif not config.get("is_active", True):
                log.debug("Sistema inactivo (is_active=false). Sin acción.")
            else:
                ip = config.get("device_ip", "")

                # ── Alerta previa
                if should_send_warning(config) and ip:
                    msg  = config.get("warning_message", "¡La TV se apagará pronto!")
                    mins = config.get("warning_minutes_before", 5)
                    if is_tv_on(ip):
                        ok = send_warning(ip, msg, mins)
                        if ok:
                            log.info(f"🔔 Alerta enviada a {ip} ({mins} min antes): {msg!r}")
                            _warning_sent_for_start = config.get("restricted_start_time")
                        else:
                            log.warning(f"⚠ Fallo al enviar alerta a {ip}")

                # ── Apagado
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

            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    main()
