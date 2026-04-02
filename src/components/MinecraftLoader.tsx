"use client";

import React from "react";
import styles from "./MinecraftLoader.module.css";

export function MinecraftLoader() {
  return (
    <div className={styles.loaderContainer}>
      <div className={styles.mcBlock}>
        <div className={styles.mcFace + " " + styles.front}></div>
        <div className={styles.mcFace + " " + styles.back}></div>
        <div className={styles.mcFace + " " + styles.right}></div>
        <div className={styles.mcFace + " " + styles.left}></div>
        <div className={styles.mcFace + " " + styles.top}></div>
        <div className={styles.mcFace + " " + styles.bottom}></div>
      </div>
      <p className={styles.loaderText}>PREPARANDO TU AVENTURA...</p>
    </div>
  );
}
