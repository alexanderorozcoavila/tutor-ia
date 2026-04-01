"use client";

import { useState, useEffect } from "react";
import { useTTS } from "@/hooks/useTTS";
import {
  Volume2, VolumeX, Mic, CheckCircle2, XCircle,
  Loader2, RefreshCw, Copy, Terminal, Info
} from "lucide-react";

type OS = "linux" | "windows" | "mac" | "unknown";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("linux")) return "linux";
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "mac";
  return "unknown";
}


// ── Bloque de código copiable ──────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative bg-gray-900 text-green-300 rounded-xl p-4 font-mono text-xs leading-relaxed overflow-x-auto">
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
        title="Copiar"
      >
        {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
      <pre className="whitespace-pre-wrap pr-8">{code}</pre>
    </div>
  );
}


// ── Panel principal ────────────────────────────────────────────────────────────
export function AudioDiagnosticsPanel() {
  const { speak, stop, isSpeaking, diagnostic } = useTTS();
  const [os, setOs] = useState<OS>("unknown");
  const [testText, setTestText] = useState("Hola, esta es una prueba del sistema de voz del tutor.");
  const [toneStatus, setToneStatus] = useState<"idle" | "playing" | "ok" | "error">("idle");
  const [selectedTab, setSelectedTab] = useState<"status" | "fix">("status");

  useEffect(() => {
    setOs(detectOS());
  }, []);

  // ── Test de tono de audio (AudioContext — no depende de TTS) ───────────────
  const playTestTone = () => {
    setToneStatus("playing");
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.start();
      osc.stop(ctx.currentTime + 1);
      osc.onended = () => {
        setToneStatus("ok");
        setTimeout(() => setToneStatus("idle"), 2000);
        ctx.close();
      };
    } catch {
      setToneStatus("error");
    }
  };

  // ── Comandos por OS ────────────────────────────────────────────────────────
  const fixes: Record<OS, { title: string; steps: { label: string; code: string }[] }[]> = {
    linux: [
      {
        title: "1. Instalar motor de voz",
        steps: [
          {
            label: "Instalar speech-dispatcher + espeak-ng",
            code: `sudo apt update
sudo apt install -y speech-dispatcher espeak-ng espeak-ng-data libspeechd2`
          },
          {
            label: "Verificar que espeak-ng funciona",
            code: `espeak-ng -v es "Hola, prueba de voz en español"`
          }
        ]
      },
      {
        title: "2. Iniciar speech-dispatcher",
        steps: [
          {
            label: "Iniciar como servicio de usuario",
            code: `systemctl --user enable speech-dispatcher
systemctl --user start speech-dispatcher`
          },
          {
            label: "O iniciarlo manualmente",
            code: `pkill speech-dispatcher; sleep 1; speech-dispatcher -d
spd-say -l es "Prueba de voz"`
          }
        ]
      },
      {
        title: "3. Verificar en Chromium",
        steps: [
          {
            label: "Lanzar Chromium con flag de Speech API",
            code: `chromium-browser --enable-speech-api --app=http://localhost:3000`
          },
          {
            label: "Si sigue sin funcionar, reinstalar Chromium",
            code: `sudo apt install --reinstall chromium-browser`
          }
        ]
      }
    ],
    windows: [
      {
        title: "1. Verificar idioma del sistema",
        steps: [
          {
            label: "Abrir configuración de idiomas",
            code: `# Ir a: Configuración → Hora e idioma → Voz\n# Agregar voz: "Spanish (Spain)" o "Spanish (United States)"\n\n# O vía PowerShell (Admin):\nAdd-WindowsCapability -Online -Name Language.Speech.es-ES~~~~0.0.1.0`
          }
        ]
      },
      {
        title: "2. Verificar en navegador",
        steps: [
          {
            label: "Chrome: habilitar voz",
            code: `# URL: chrome://settings/languages\n# Asegurarse de tener "Español" instalado con voces`
          }
        ]
      }
    ],
    mac: [
      {
        title: "1. Verificar voces del sistema",
        steps: [
          {
            label: "Agregar voz en español",
            code: `# Ir a: Preferencias del Sistema → Accesibilidad → Voz\n# O: Preferencias del Sistema → Idioma y región → Voz\n# Descargar "Mónica" o "Paulina" (voces españolas de alta calidad)`
          },
          {
            label: "Probar desde terminal",
            code: `say -v Mónica "Hola, esta es una prueba de voz"`
          }
        ]
      }
    ],
    unknown: [
      {
        title: "Sistema no detectado",
        steps: [
          {
            label: "Verificar voces manualmente en el navegador",
            code: `# Abrir consola del navegador (F12) y ejecutar:\nspeechSynthesis.getVoices().filter(v => v.lang.startsWith('es'))`
          }
        ]
      }
    ]
  };

  const statusColor = {
    ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
    checking: "bg-blue-50 border-blue-200 text-blue-800",
    "no-api": "bg-red-50 border-red-200 text-red-800",
    "no-voices": "bg-red-50 border-red-200 text-red-800",
    "no-spanish": "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
  }[diagnostic.status] ?? "bg-gray-50 border-gray-200";

  const statusIcon = {
    ok: <CheckCircle2 className="text-emerald-500" size={20} />,
    checking: <Loader2 className="text-blue-500 animate-spin" size={20} />,
    "no-api": <XCircle className="text-red-500" size={20} />,
    "no-voices": <XCircle className="text-red-500" size={20} />,
    "no-spanish": <Info className="text-amber-500" size={20} />,
    error: <XCircle className="text-red-500" size={20} />,
  }[diagnostic.status] ?? null;

  const osLabel = { linux: "🐧 Linux", windows: "🪟 Windows", mac: "🍎 macOS", unknown: "🖥️ Desconocido" }[os];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-900 to-indigo-900 p-8 rounded-[2.5rem] shadow-xl text-white">
        <h2 className="text-2xl font-black mb-1 flex items-center gap-3">
          <Volume2 className="text-violet-300" size={24} /> Audio y Voz
        </h2>
        <p className="text-violet-300 text-sm font-bold">
          Diagnóstico del sistema de audio y síntesis de voz. Sistema detectado: <span className="text-white">{osLabel}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl w-fit">
        {(["status", "fix"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-5 py-2 rounded-xl font-black text-sm transition-all ${selectedTab === tab ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-gray-800"}`}
          >
            {tab === "status" ? "📊 Estado" : "🔧 Solucionar"}
          </button>
        ))}
      </div>

      {/* ── Tab: Estado ──────────────────────────────────────────────────────── */}
      {selectedTab === "status" && (
        <div className="space-y-4">

          {/* Banner de estado TTS */}
          <div className={`border-2 rounded-2xl p-5 flex items-start gap-4 ${statusColor}`}>
            <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>
            <div className="flex-1">
              <p className="font-black text-sm">Sistema de Voz (Web Speech API)</p>
              <p className="text-sm mt-1 font-bold opacity-80">{diagnostic.message}</p>
              <div className="flex gap-4 mt-3 text-xs font-black">
                <span>Voces totales: <span className="font-mono">{diagnostic.totalVoices}</span></span>
                <span>En español: <span className="font-mono">{diagnostic.spanishVoices}</span></span>
                {diagnostic.selectedVoice && (
                  <span>Activa: <span className="font-mono">{diagnostic.selectedVoice}</span></span>
                )}
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              title="Recargar y re-detectar"
              className="flex-shrink-0 p-2 rounded-xl bg-white/40 hover:bg-white/60 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Test de audio puro (AudioContext) */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-6">
            <h3 className="font-black text-gray-800 mb-1">🔊 Test de Audio (Tono)</h3>
            <p className="text-sm text-gray-500 font-bold mb-4">
              Prueba independiente del TTS — verifica que el altavoz y el sistema de audio funcionen.
            </p>
            <button
              onClick={playTestTone}
              disabled={toneStatus === "playing"}
              className={`px-6 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
                toneStatus === "ok" ? "bg-emerald-100 text-emerald-700" :
                toneStatus === "error" ? "bg-red-100 text-red-700" :
                "bg-indigo-600 hover:bg-indigo-500 text-white"
              } disabled:opacity-50`}
            >
              {toneStatus === "playing" && <Loader2 className="animate-spin" size={16} />}
              {toneStatus === "ok" && <CheckCircle2 size={16} />}
              {toneStatus === "error" && <XCircle size={16} />}
              {toneStatus === "idle" && <Volume2 size={16} />}
              {toneStatus === "idle" ? "Reproducir tono (La 440 Hz)" :
               toneStatus === "playing" ? "Reproduciendo..." :
               toneStatus === "ok" ? "✅ Audio OK" : "❌ Sin audio"}
            </button>
            {toneStatus === "error" && (
              <p className="text-xs text-red-600 font-bold mt-2">
                El sistema de audio no está disponible. Verifica el volumen y los altavoces/auriculares.
              </p>
            )}
          </div>

          {/* Test de voz TTS */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-6">
            <h3 className="font-black text-gray-800 mb-1">🎙️ Test de Voz (TTS)</h3>
            <p className="text-sm text-gray-500 font-bold mb-4">
              Prueba la síntesis de voz en español. Necesita audio funcionando + voces instaladas.
            </p>
            <div className="flex gap-3">
              <input
                value={testText}
                onChange={e => setTestText(e.target.value)}
                className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:outline-none focus:border-indigo-200"
                placeholder="Escribe un texto para probar..."
              />
              <button
                onClick={() => isSpeaking ? stop() : speak(testText)}
                disabled={diagnostic.status === "no-api" || !testText}
                className={`px-5 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 flex-shrink-0 ${
                  isSpeaking ? "bg-red-100 text-red-700 hover:bg-red-200" :
                  "bg-violet-600 hover:bg-violet-500 text-white"
                } disabled:opacity-40`}
              >
                {isSpeaking ? <><VolumeX size={16} /> Detener</> : <><Mic size={16} /> Hablar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Solucionar ───────────────────────────────────────────────────── */}
      {selectedTab === "fix" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-sm text-amber-800 font-bold">
            Guía de solución para <span className="font-black">{osLabel}</span>.
            Si estás en otro sistema, cambia el sistema detectado recargando desde ese equipo.
          </div>

          {fixes[os].map((section, si) => (
            <div key={si} className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <h3 className="font-black text-gray-800 flex items-center gap-2">
                  <Terminal size={16} className="text-indigo-500" /> {section.title}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {section.steps.map((step, idx) => (
                  <div key={idx}>
                    <p className="text-sm font-black text-gray-600 mb-2">{step.label}</p>
                    <CodeBlock code={step.code} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Paso universal: validar en consola */}
          <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="font-black text-gray-800 flex items-center gap-2">
                <Terminal size={16} className="text-indigo-500" /> Verificación universal (consola del navegador)
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 font-bold">
                Abre las herramientas del navegador con <kbd className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">F12</kbd> → Consola, y ejecuta:
              </p>
              <CodeBlock code={`// Cuántas voces hay
console.log("Total voces:", speechSynthesis.getVoices().length);

// Voces en español
console.table(
  speechSynthesis.getVoices()
    .filter(v => v.lang.startsWith("es"))
    .map(v => ({ nombre: v.name, idioma: v.lang, local: v.localService }))
);

// Prueba rápida de habla
const u = new SpeechSynthesisUtterance("Hola mundo");
u.lang = "es";
u.onerror = e => console.error("Error:", e.error);
u.onend = () => console.log("✅ TTS funcionó correctamente");
speechSynthesis.speak(u);`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
