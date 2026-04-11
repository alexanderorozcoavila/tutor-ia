#!/usr/bin/env python3
"""
tv_control.py — Control Parental Smart TV Samsung
Sistema: IA Tutor (ia-tutor)

Worker que corre en Termux (Android). Lee la configuración de un alumno
desde Supabase y apaga el televisor Samsung si corresponde según las
reglas de prioridad definidas en el PRD.

Variables de entorno requeridas (mismas credenciales que .env.local del proyecto):
  SUPABASE_URL  → valor de NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_KEY  → valor de SUPABASE_SERVICE_ROLE_KEY
  STUDENT_ID    → UUID del alumno a monitorear
"""

import os
import time
import subprocess
import logging
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from dotenv import load_dotenv

# ── Supabase ───────────────────────────────────────────────────────────
try:
    from supabase import create_client, Client
except ImportError:
    raise SystemExit("❌ Falta la librería 'supabase'. Ejecuta: pip install supabase")

# ── Samsung TV WS ──────────────────────────────────────────────────────
try:
    from samsungtvws import SamsungTVWS
except ImportError:
    raise SystemExit("❌ Falta la librería 'samsungtvws'. Ejecuta: pip install samsungtvws")

# ── Configuración ──────────────────────────────────────────────────────
load_dotenv(os.path.expanduser("~/.env"))

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")
STUDENT_ID: str   = os.environ.get("STUDENT_ID", "")
POLL_INTERVAL: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "45"))

if not all([SUPABASE_URL, SUPABASE_KEY, STUDENT_ID]):
    raise SystemExit(
        "❌ Faltan variables de entorno.\n"
        "   Asegúrate de que ~/.env contiene SUPABASE_URL, SUPABASE_KEY y STUDENT_ID."
    )

# ── Logging ────────────────────────────────────────────────────────────
log_path = os.path.expanduser("~/tv_control.log")
handler = TimedRotatingFileHandler(log_path, when="W0", backupCount=4)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"))
logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()])
log = logging.getLogger("tv_control")

# ── Cliente Supabase ───────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ══════════════════════════════════════════════════════════════════════
# Lógica de negocio
# ══════════════════════════════════════════════════════════════════════

def fetch_config() -> dict | None:
    """Consulta tv_config del alumno en Supabase. Retorna None si hay error."""
    try:
        res = (
            supabase.table("tv_config")
            .select("*")
            .eq("student_id", STUDENT_ID)
            .maybe_single()
            .execute()
        )
        return res.data
    except Exception as e:
        log.warning(f"Error al consultar Supabase: {e}")
        return None  # fail-safe: si no hay internet, no hacer nada


def should_tv_be_off(config: dict) -> bool:
    """
    Árbol de decisión del PRD:
      Prioridad 1: force_power_off (apagado manual) — anula todo.
      Prioridad 2: horario de bloqueo — con soporte de cruce de medianoche.
    """
    if not config.get("is_active", True):
        return False  # Master switch OFF → no evaluar nada

    # Prioridad 1 — Orden directa del administrador
    if config.get("force_power_off", False):
        log.debug("Regla activada: force_power_off=true")
        return True

    # Prioridad 2 — Evaluación de horario
    start_str = config.get("restricted_start_time")
    end_str   = config.get("restricted_end_time")

    if start_str and end_str:
        now   = datetime.now().time()
        start = datetime.strptime(start_str[:5], "%H:%M").time()
        end_t = datetime.strptime(end_str[:5],   "%H:%M").time()

        if start < end_t:
            # Rango normal: ej. 14:00 – 18:00
            in_range = start <= now <= end_t
        else:
            # Rango cruzando medianoche: ej. 22:00 – 08:00
            in_range = now >= start or now <= end_t

        if in_range:
            log.debug(f"Regla activada: horario {start_str[:5]} → {end_str[:5]}")
            return True

    return False


def is_tv_on(ip: str) -> bool:
    """Ping a la IP del televisor. Retorna True si responde (TV encendida)."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", ip],
            capture_output=True,
            timeout=5,
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
        log.warning(f"No se pudo enviar comando WebSocket a {ip}: {e}")
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
                log.warning("Sin configuración disponible. Reintentando en el próximo ciclo.")
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
            # Nunca dejar que el loop crashee
            log.error(f"Error inesperado en ciclo principal: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
