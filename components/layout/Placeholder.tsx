import { Icon, type IconName } from "../ui/Icon";
import styles from "./Placeholder.module.css";

export interface PlaceholderProps {
  icon: IconName;
  tone?: "pink" | "orange" | "green" | "blue";
  title: string;
  /** Penjelasan singkat isi layar yang akan dibangun. */
  text: string;
  /** Tahap build yang akan mengisi layar ini. */
  stage: string;
}

/** Penanda layar yang isinya belum dibangun (khusus Tahap 1). */
export function Placeholder({ icon, tone = "blue", title, text, stage }: PlaceholderProps) {
  return (
    <div className={`${styles.placeholder} ${styles[tone]}`}>
      <span className={styles.icon}>
        <Icon name={icon} size={30} strokeWidth={1.8} />
      </span>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{text}</p>
      <span className={styles.badge}>{stage}</span>
    </div>
  );
}
