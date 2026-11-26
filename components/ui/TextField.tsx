"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import styles from "./TextField.module.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Teks bantuan di bawah input. */
  hint?: string;
  /** Pesan galat; bila ada, input ditandai tidak valid. */
  error?: string;
  /** Tandai wajib (bintang di label). */
  requiredMark?: boolean;
  /** Elemen di sisi kanan input, misalnya tombol tampilkan password. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, hint, error, requiredMark, trailing, className, ref, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {requiredMark ? (
          <span className={styles.required} aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <div className={`${styles.control} ${error ? styles.invalid : ""}`}>
        <input {...rest} ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={styles.input} />
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Input password dengan tombol tampilkan/sembunyikan. */
export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
        >
          {visible ? "Sembunyikan" : "Tampilkan"}
        </button>
      }
    />
  );
}
