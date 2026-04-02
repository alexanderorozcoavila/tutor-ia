"use client";

import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { Gift, Home, Sword, User, LogOut } from "lucide-react";
import styles from "./MinecraftModuleWrapper.module.css";

interface Props {
  children: React.ReactNode;
  moduleTitle: string;
  onBack: () => void;
}

export function MinecraftModuleWrapper({ children, moduleTitle, onBack }: Props) {
  const { user, logout } = useAuth();

  // Hide the global system menu while in the module
  React.useEffect(() => {
    const styleId = "hide-global-menu-module";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = ".md\\:block.fixed.bottom-6.right-6.z-40 { display: none !important; }";
      document.head.appendChild(style);
    }
    return () => {
      const s = document.getElementById(styleId);
      if (s) s.remove();
    };
  }, []);

  return (
    <div className={styles.mcWrapper}>
      {/* ── HEADER ────────────────────────────────────────── */}
      <header className={styles.mcHeader}>
        <div className={styles.headerLogoArea}>
          <div className={styles.mcLogo}>
            {[...Array(16)].map((_, i) => (
              <div key={i} style={{ background: i % 2 === 0 ? "#ff4444" : "#ffffff", border: "1px solid rgba(0,0,0,0.1)" }}></div>
            ))}
          </div>
          <div className="flex flex-col">
            <h1 className={styles.appTitle}>IA TUTOR</h1>
            <span className={styles.moduleMeta}>{moduleTitle.toUpperCase()}</span>
          </div>
        </div>

        <nav className="flex gap-4">
          <button onClick={onBack} className="text-white hover:text-amber-400 font-bold flex items-center gap-2 outline-none">
             <Home size={18} /> ESCRITORIO
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div style={{ textAlign: "right", marginRight: "1rem" }}>
            <p style={{ fontStyle: "italic", fontSize: "14px", marginBottom: "0" }}>Explorador</p>
            <p style={{ fontFamily: "var(--font-pixel)", fontSize: "9px", color: "#FFFF55", marginTop: "2px" }}>
              {user?.username || "Steve"}
            </p>
          </div>
          <button onClick={() => logout()} className="text-white hover:text-red-400 p-2" title="Salir">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────── */}
      <main className={styles.mainContent}>
        {children}
      </main>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className={styles.mcFooter}>
        <div className={styles.footerContent}>
          <p style={{ fontFamily: "var(--font-pixel)", fontSize: "8px", color: "#FFFF55" }}>MODU-CRAFT SYSTEM v1.1</p>
          <p>© 2026 Misión Educativa</p>
        </div>
      </footer>
    </div>
  );
}
