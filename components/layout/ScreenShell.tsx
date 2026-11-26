"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./ScreenShell.module.css";

export interface ScreenShellProps {
  title: string;
  description?: string;
  /** Label kecil di atas judul (misalnya "Langkah 1"). */
  eyebrow?: string;
  children?: ReactNode;
  /** Tombol aksi; selalu terlihat di bagian bawah layar. */
  actions?: ReactNode;
  /** Tata letak tengah (untuk layar Selesai). */
  centered?: boolean;
  /** Elemen di atas judul, misalnya ilustrasi status. */
  leading?: ReactNode;
}

/**
 * Kerangka satu layar: judul, isi (boleh scroll di dalam layar bila panjang),
 * dan bilah aksi yang menempel di bawah.
 */
export function ScreenShell({ title, description, eyebrow, children, actions, centered = false, leading }: ScreenShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Fokus ke judul saat layar tampil agar pembaca layar mengumumkan layar baru.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className={styles.shell} aria-labelledby="screen-title">
      <div className={styles.body}>
        <div className={`${styles.content} ${centered ? styles.centered : ""}`}>
          {leading ? <div className={styles.leading}>{leading}</div> : null}
          <div className={styles.heading}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1 id="screen-title" ref={headingRef} tabIndex={-1} className={styles.title}>
              {title}
            </h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {children}
        </div>
      </div>
      {actions ? (
        <div className={styles.actionBar}>
          <div className={styles.actions}>{actions}</div>
        </div>
      ) : null}
    </section>
  );
}
