"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Toast.module.css";

export type ToastTone = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  leaving: boolean;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 3800;
const LEAVE_MS = 220;
const MAX_VISIBLE = 3;

const TONE_ICON: Record<ToastTone, IconName> = {
  info: "info",
  success: "check",
  warning: "alert",
  error: "alert",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const t = setTimeout(() => {
      setItems((list) => list.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, LEAVE_MS);
    timers.current.set(id, t);
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, tone, message, leaving: false }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`${styles.toast} ${styles[t.tone]} ${t.leaving ? styles.leaving : ""}`}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon name={TONE_ICON[t.tone]} size={18} />
            </span>
            <p className={styles.message}>{t.message}</p>
            <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Tutup pesan">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>.");
  return ctx;
}
