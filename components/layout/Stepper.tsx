import { Icon } from "../ui/Icon";
import styles from "./Stepper.module.css";

export interface StepItem {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: readonly StepItem[];
  /** Indeks langkah aktif (0-based). */
  current: number;
}

/**
 * Indikator langkah. Di HP: titik bernomor + label langkah aktif.
 * Di tablet/laptop (≥ 768 px): label tampil di bawah setiap titik.
 */
export function Stepper({ steps, current }: StepperProps) {
  const total = steps.length;
  const active = steps[current];
  const progress = total > 1 ? (current / (total - 1)) * 100 : 100;

  return (
    <nav className={styles.stepper} aria-label="Langkah laporan">
      <div className={styles.inner}>
        <p className={styles.caption}>
          <span className={styles.count}>
            Langkah {current + 1} dari {total}
          </span>
          {active ? <span className={styles.activeLabel}>{active.label}</span> : null}
        </p>

        <div className={styles.trackWrap}>
          <span className={styles.rail} aria-hidden="true">
            <span className={styles.railFill} style={{ width: `${progress}%` }} />
          </span>
          <ol className={styles.track}>
          {steps.map((step, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <li key={step.id} className={`${styles.step} ${styles[state]}`} aria-current={state === "current" ? "step" : undefined}>
                <span className={styles.dot}>
                  {state === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : <span>{i + 1}</span>}
                </span>
                <span className={styles.label}>
                  {step.label}
                  <span className="visually-hidden">
                    {state === "done" ? " (selesai)" : state === "current" ? " (sedang berjalan)" : ""}
                  </span>
                </span>
              </li>
            );
          })}
          </ol>
        </div>
      </div>
    </nav>
  );
}
