import styles from "./Spinner.module.css";

export interface SpinnerProps {
  size?: number;
  /** Warna garis; "currentColor" mengikuti warna teks induk. */
  tone?: "primary" | "currentColor";
  /** Teks untuk pembaca layar. */
  label?: string;
}

export function Spinner({ size = 24, tone = "primary", label = "Memuat" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`${styles.spinner} ${tone === "primary" ? styles.primary : ""}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Blok pemuatan untuk mengisi area konten saat data sedang diambil. */
export function LoadingBlock({ text = "Memuat data…" }: { text?: string }) {
  return (
    <div className={styles.block}>
      <Spinner size={32} label={text} />
      <p>{text}</p>
    </div>
  );
}
