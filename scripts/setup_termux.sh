#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# setup_termux.sh — Configuración del worker tv_control en Termux
# Proyecto: IA Tutor (ia-tutor)
# ============================================================
set -e

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   IA Tutor — Setup Control Parental Smart TV         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Dependencias del sistema ────────────────────────────
echo "📦 Instalando dependencias del sistema..."
pkg install -y python python-pip

# ── 2. Dependencias Python ─────────────────────────────────
echo ""
echo "🐍 Instalando librerías Python..."
pip install --upgrade pip
pip install supabase samsungtvws python-dotenv

# ── 3. Crear archivo de variables de entorno ───────────────
echo ""
ENV_FILE="$HOME/.env"

if [ -f "$ENV_FILE" ]; then
  echo "⚠  Ya existe un archivo ~/.env. Omitiendo creación (edítalo manualmente si es necesario)."
else
  echo "📝 Creando archivo ~/.env con los valores del proyecto..."
  cat > "$ENV_FILE" << 'EOF'
# Credenciales Supabase — copiar exactamente de .env.local del proyecto IA Tutor

SUPABASE_URL=https://bodylabhjiwmakcpktux.supabase.co
SUPABASE_KEY=sb_publishable_gx5GRMrsVwxFqSMirC1-3g_BcsxBAy1
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvZHlsYWJoaml3bWFrY3BrdHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ1OTE4NywiZXhwIjoyMDkwMDM1MTg3fQ.D94MpSPFuN3mbJfzUneX5VsWeGQlljPx4NKQFwTmUAk


# UUID del alumno a monitorear (obténlo desde el dashboard de admin)
STUDENT_ID=2e613db4-5768-4022-9e0f-6bc26ff2df35

# Intervalo de consulta en segundos (mínimo 30, recomendado 45)
POLL_INTERVAL_SECONDS=20
EOF
  echo "   ✅ Archivo creado en $ENV_FILE"
  echo "   ⚠  EDITA el archivo y completa SUPABASE_KEY y STUDENT_ID antes de continuar."
fi

# ── 4. Copiar script al directorio home ────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_SRC="$SCRIPT_DIR/tv_control.py"
SCRIPT_DEST="$HOME/tv_control.py"

if [ -f "$SCRIPT_SRC" ]; then
  cp "$SCRIPT_SRC" "$SCRIPT_DEST"
  echo ""
  echo "📄 Script copiado a $SCRIPT_DEST"
else
  echo ""
  echo "⚠  No se encontró tv_control.py en $SCRIPT_DIR"
  echo "   Cópialo manualmente a $HOME/tv_control.py"
fi

# ── 5. Configurar auto-arranque con Termux:Boot ────────────
echo ""
echo "🚀 Configurando auto-arranque con Termux:Boot..."
mkdir -p "$HOME/.termux/boot"

BOOT_SCRIPT="$HOME/.termux/boot/start_tv_control.sh"
cat > "$BOOT_SCRIPT" << BOOT
#!/data/data/com.termux/files/usr/bin/bash
# Auto-arrancado por Termux:Boot al iniciar el dispositivo
termux-wake-lock  # Evita que Android suspenda el proceso durante la noche
sleep 10  # Esperar a que la red esté disponible
cd \$HOME
python tv_control.py >> \$HOME/tv_control.log 2>&1 &
BOOT
chmod +x "$BOOT_SCRIPT"
echo "   ✅ Script de arranque creado: $BOOT_SCRIPT"

# ── 6. Resumen final ───────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅ Setup completado                                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Próximos pasos:"
echo "  1. Edita ~/.env y completa SUPABASE_KEY y STUDENT_ID"
echo "  2. Prueba manualmente:  python ~/tv_control.py"
echo "  3. Instala Termux:Boot desde F-Droid para auto-arranque"
echo "  4. Desde el dashboard de admin, configura los horarios"
echo "     y activa el apagado manual según sea necesario."
echo ""
