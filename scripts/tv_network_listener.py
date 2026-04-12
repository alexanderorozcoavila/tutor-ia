#!/usr/bin/env python3
"""
tv_network_listener.py — Receptor de eventos push para Control Parental (Script A)
Sistema: IA Tutor (ia-tutor)

Worker que corre en Termux (Android). Se conecta a NTFY.sh para recibir la
configuración actualizada vía stream y la guarda localmente en tv_config.json.
Esto evita llamadas redundantes a Supabase (polling).
"""

import os
import time
import json
import logging
from logging.handlers import TimedRotatingFileHandler
import requests
from dotenv import load_dotenv

# ── Configuración ──────────────────────────────────────────────────────
load_dotenv(os.path.expanduser("~/.env"))

STUDENT_ID: str = os.environ.get("STUDENT_ID", "")
NTFY_TOPIC: str = f"iatutor_tv_config_{STUDENT_ID}"

if not STUDENT_ID:
    raise SystemExit("❌ Falta STUDENT_ID en ~/.env")

# ── Logging ────────────────────────────────────────────────────────────
log_path = os.path.expanduser("~/tv_network_listener.log")
handler = TimedRotatingFileHandler(log_path, when="W0", backupCount=4)
handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"
))
logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()])
log = logging.getLogger("tv_network_listener")

CONFIG_PATH = os.path.expanduser("~/tv_config.json")
TEMP_CONFIG_PATH = os.path.expanduser("~/tv_config_temp.json")

def process_message(message_str: str) -> None:
    """Procesa el mensaje JSON recibido de NTFY y lo guarda en disco de forma atómica."""
    try:
        data = json.loads(message_str)
        if data.get("event") == "message":
            payload_str = data.get("message")
            if not payload_str:
                return
            
            # Verificar que el payload sea un JSON válido (la config)
            config_data = json.loads(payload_str)
            
            # Guardado atómico
            with open(TEMP_CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
            
            os.replace(TEMP_CONFIG_PATH, CONFIG_PATH)
            log.info("✅ Configuración actualizada y guardada en tv_config.json")
    except json.JSONDecodeError:
        log.warning("Recibido payload no JSON o irrelevante.")
    except Exception as e:
        log.error(f"Error procesando mensaje: {e}")

def main() -> None:
    log.info(f"▶ tv_network_listener iniciado — escuchando canal: {NTFY_TOPIC}")
    stream_url = f"https://ntfy.sh/{NTFY_TOPIC}/json"
    
    backoff_seconds = 1
    max_backoff = 60
    
    while True:
        try:
            log.info(f"Conectando a {stream_url}...")
            # Timeout alto para stream
            with requests.get(stream_url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                log.info("Conectado exitosamente. Esperando eventos...")
                backoff_seconds = 1  # Resetear backoff
                
                for line in resp.iter_lines():
                    if line:
                        process_message(line.decode('utf-8'))
        except requests.exceptions.RequestException as e:
            log.warning(f"Error de red: {e}")
        except Exception as e:
            log.error(f"Error inesperado: {e}")
            
        log.info(f"Reconectando en {backoff_seconds} segundos...")
        time.sleep(backoff_seconds)
        backoff_seconds = min(backoff_seconds * 2, max_backoff)

if __name__ == "__main__":
    main()
