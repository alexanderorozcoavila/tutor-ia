"use client";

import React from "react";
import { Trophy, Star, ArrowRight, Sparkles } from "lucide-react";
import styles from "./MinecraftCongrats.module.css";
import confetti from "canvas-confetti";

interface Props {
  title?: string;
  subtitle?: string;
  onFinish: () => void;
  xpGained?: number;
  buttonText?: string;
}

export function MinecraftCongrats({ 
  title = "¡MISIÓN CUMPLIDA!", 
  subtitle = "Has demostrado gran valentía y sabiduría.",
  onFinish,
  xpGained = 20,
  buttonText = "CONTINUAR AVENTURA"
}: Props) {
  
  React.useEffect(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.congratsOverlay}>
      <div className={styles.congratsCard}>
        <div className={styles.sunburst}></div>
        
        <div className={styles.rewardIconArea}>
          <div className={styles.diamondItem}>
            <Star fill="#55FFFF" size={48} className={styles.glowIcon} />
          </div>
          <Sparkles className={styles.sparkle1} size={24} />
          <Sparkles className={styles.sparkle2} size={24} />
        </div>

        <h1 className={styles.congratsTitle}>{title}</h1>
        <p className={styles.congratsSubtitle}>{subtitle}</p>

        <div className={styles.xpBadge}>
          <Trophy size={20} className="text-yellow-400" />
          <span>+{xpGained} XP DE AVENTURA</span>
        </div>

        <button onClick={onFinish} className={styles.mcBtn}>
          {buttonText} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
