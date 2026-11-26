import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Garis aksen warna merek di sisi atas kartu. */
  accent?: "pink" | "orange" | "green" | "blue" | "brand";
  padded?: boolean;
  children: ReactNode;
}

export function Card({ accent, padded = true, className, children, ...rest }: CardProps) {
  const classes = [styles.card, padded ? styles.padded : "", accent ? `${styles.accent} ${styles[`accent-${accent}`]}` : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div {...rest} className={classes}>
      {children}
    </div>
  );
}
