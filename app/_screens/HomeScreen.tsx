"use client";

import { useEffect, useRef } from "react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { useFlow } from "./flow";
import { HubScreen } from "./HubScreen";
import styles from "./HomeScreen.module.css";

/** Gelembung dekoratif yang meniru pola titik pada logo YOFC. */
const BUBBLES = [
  { tone: "pink", size: 120, top: "6%", left: "-34px", delay: "0s" },
  { tone: "orange", size: 64, top: "18%", left: "78%", delay: "1.2s" },
  { tone: "green", size: 88, top: "74%", left: "84%", delay: "0.6s" },
  { tone: "blue", size: 150, top: "82%", left: "-48px", delay: "1.8s" },
  { tone: "orange", size: 28, top: "64%", left: "12%", delay: "2.4s" },
  { tone: "blue", size: 22, top: "10%", left: "58%", delay: "0.9s" },
  { tone: "pink", size: 18, top: "88%", left: "64%", delay: "1.5s" },
] as const;

export function HomeScreen() {
  const { session, booting, go } = useFlow();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [session]);

  // Setelah login, Beranda menjadi menu fitur (Phase 2).
  if (!booting && session) return <HubScreen />;

  return (
    <div className={styles.home}>
      <div className={styles.bubbles} aria-hidden="true">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className={`${styles.bubble} ${styles[b.tone]}`}
            style={{ width: b.size, height: b.size, top: b.top, left: b.left, animationDelay: b.delay }}
          />
        ))}
      </div>

      <div className={styles.scroll}>
        <div className={styles.panel}>
          <div className={styles.hero}>
            <BrandLogo height={72} priority className={styles.logo} />
            <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
              WHControl
            </h1>
            <p className={styles.subtitle}>Warehouse Control</p>
            <p className={styles.tagline}>
              Kontrol material gudang subkontraktor YOFC: verifikasi DO, TO, dan BOQ, serta laporan Visit stok gudang
              dengan foto bukti.
            </p>
          </div>

          {booting ? (
            <div className={`${styles.card} ${styles.booting}`}>
              <Spinner size={22} label="Memeriksa sesi" />
              <span>Memeriksa sesi…</span>
            </div>
          ) : (
            <div className={styles.card}>
              <div className={styles.actions}>
                <Button block icon={<Icon name="login" />} onClick={() => go("login")}>
                  Login
                </Button>
              </div>
              <p className={styles.note}>Gunakan nama Subcont dan password yang diberikan YOFC.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
