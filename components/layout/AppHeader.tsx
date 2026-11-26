import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import styles from "./AppHeader.module.css";

export interface AppHeaderProps {
  /** Konten di sisi kanan (misalnya nama subcont atau tombol). */
  right?: ReactNode;
  /** Bila diisi, logo + nama aplikasi menjadi tombol kembali ke Beranda. */
  onHome?: () => void;
  /** Nonaktifkan tombol Beranda (misalnya saat laporan sedang dikirim). */
  homeDisabled?: boolean;
}

export function AppHeader({ right, onHome, homeDisabled }: AppHeaderProps) {
  const brand = (
    <>
      <BrandLogo height={30} priority />
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.appName}>WHControl</span>
    </>
  );
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {onHome ? (
          <button
            type="button"
            className={`${styles.brand} ${styles.brandBtn}`}
            onClick={onHome}
            disabled={homeDisabled}
            aria-label="Kembali ke Beranda"
            title={homeDisabled ? "Tunggu sampai pengiriman selesai" : "Kembali ke Beranda"}
          >
            {brand}
          </button>
        ) : (
          <div className={styles.brand}>{brand}</div>
        )}
        {right ? <div className={styles.right}>{right}</div> : null}
      </div>
      <div className={styles.stripe} aria-hidden="true" />
    </header>
  );
}
