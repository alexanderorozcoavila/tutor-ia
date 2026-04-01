import os
import time
import subprocess
from supabase import create_client, Client
from dotenv import load_dotenv

# 1. CARGAR CONFIGURACIÓN DESDE .env.local
# Cambia 'ruta/env.local' por la ruta real, ej: '/home/alumno/ia-tutor/.env.local'
ruta_env = "/home/alumno/ia-tutor/.env.local"
load_dotenv(dotenv_path=ruta_env)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: No se encontraron las credenciales en el archivo .env.local")
    exit(1)

# 2. INICIALIZAR CLIENTE
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ID del Alumno (Asegúrate de que este ID sea el correcto en tu tabla users)
alumno_id = "EL_ID_DE_TU_ALUMNO" 
proceso_recompensa = None

print("Agente iniciado y monitoreando...")

while True:
    try:
        # Consultar el estado de control en Supabase
        respuesta = supabase.table("control_dispositivo").select("*").eq("alumno_id", alumno_id).single().execute()
        
        if respuesta.data:
            datos = respuesta.data
            app_permitida = datos.get('app_permitida', 'none')
            minutos = datos.get('minutos_disponibles', 0)

            # LÓGICA DE ACTIVACIÓN
            if app_permitida != 'none' and minutos > 0:
                if proceso_recompensa is None:
                    print(f"Abriendo {app_permitida}. Tiempo: {minutos} min.")
                    # Abrir internet en el Firewall
                    os.system("sudo ufw default allow outgoing")
                    
                    url_app = "https://www.youtubekids.com" if app_permitida == "youtube" else "https://www.netflix.com"
                    
                    # Lanzar navegador en modo Kiosco sobre la app principal
                    comando = f"sudo -u alumno DISPLAY=:0 chromium-browser --kiosk --app={url_app}"
                    proceso_recompensa = subprocess.Popen(comando, shell=True)

                # Descontar 1 minuto cada 60 segundos
                time.sleep(60)
                nuevo_tiempo = minutos - 1
                supabase.table("control_dispositivo").update({"minutos_disponibles": nuevo_tiempo}).eq("alumno_id", alumno_id).execute()
            
            else:
                # LÓGICA DE BLOQUEO (Tiempo agotado o sin permiso)
                if proceso_recompensa is not None:
                    print("Cerrando aplicación y bloqueando internet...")
                    os.system("pkill -f 'chromium-browser --kiosk --app'")
                    proceso_recompensa = None
                    
                    # Volver a bloquear internet (Solo permitimos tráfico DNS y HTTPS necesario)
                    os.system("sudo ufw default deny outgoing")
                    os.system("sudo ufw allow out to any port 443")
                    
                    # Resetear estado en la DB
                    supabase.table("control_dispositivo").update({"app_permitida": "none", "minutos_disponibles": 0}).eq("alumno_id", alumno_id).execute()

        time.sleep(10) # Revisar cada 10 segundos si no hay actividad

    except Exception as e:
        print(f"Error en el ciclo: {e}")
        time.sleep(10)