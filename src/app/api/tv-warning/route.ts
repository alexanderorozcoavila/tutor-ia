import { NextRequest } from 'next/server';

/**
 * GET /api/tv-warning?msg=...&min=5
 * Retorna una página HTML fullscreen con el mensaje de advertencia.
 * El script tv_control.py abre esta URL en el navegador de la TV
 * antes de apagarla.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('msg') || '¡Atención! La TV se apagará pronto.';
  const minutes = searchParams.get('min') || '5';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IA Tutor — Aviso</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw; height: 100vh;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      overflow: hidden;
    }
    .card {
      text-align: center; padding: 60px 80px;
      background: rgba(255,255,255,0.08);
      border: 2px solid rgba(255,255,255,0.15);
      border-radius: 40px;
      backdrop-filter: blur(20px);
      max-width: 900px;
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(99,102,241,0.3); }
      50% { transform: scale(1.02); box-shadow: 0 0 80px rgba(99,102,241,0.5); }
    }
    .icon { font-size: 80px; margin-bottom: 24px; }
    .title {
      font-size: 28px; font-weight: 900;
      color: #fbbf24; text-transform: uppercase;
      letter-spacing: 4px; margin-bottom: 20px;
    }
    .message {
      font-size: 42px; font-weight: 800;
      color: #ffffff; line-height: 1.3;
      margin-bottom: 24px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .countdown {
      font-size: 22px; color: rgba(255,255,255,0.7);
      font-weight: 600;
    }
    .countdown span {
      color: #f87171; font-weight: 900; font-size: 26px;
    }
    .bar {
      margin-top: 32px; height: 6px;
      background: rgba(255,255,255,0.15);
      border-radius: 99px; overflow: hidden;
    }
    .bar-fill {
      height: 100%; width: 100%;
      background: linear-gradient(90deg, #fbbf24, #f87171);
      border-radius: 99px;
      animation: drain ${parseInt(minutes) * 60}s linear forwards;
    }
    @keyframes drain {
      from { width: 100%; }
      to { width: 0%; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <div class="title">IA Tutor · Control Parental</div>
    <div class="message">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="countdown">La TV se apagará en <span>${minutes} minuto(s)</span></div>
    <div class="bar"><div class="bar-fill"></div></div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
