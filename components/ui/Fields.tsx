"use client";

import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";
import styles from "./Fields.module.css";

interface FieldShellProps {
  id: string;
  label: string;
  requiredMark?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function FieldShell({ id, label, requiredMark, hint, error, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {requiredMark ? <span className={styles.required} aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  requiredMark?: boolean;
  hint?: string;
  error?: string;
}

export function SelectField({ label, options, placeholder, requiredMark, hint, error, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} requiredMark={requiredMark} hint={hint} error={error}>
      <div className={`${styles.selectWrap} ${error ? styles.invalid : ""}`}>
        <select
          {...rest}
          id={id}
          className={styles.select}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          <Icon name="arrowRight" size={16} />
        </span>
      </div>
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        {...rest}
        id={id}
        className={`${styles.textarea} ${error ? styles.invalid : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
    </FieldShell>
  );
}

export interface ChecklistProps {
  label: string;
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

/** Checklist multi-pilih berbentuk chip yang mudah disentuh. */
export function Checklist({ label, options, value, onChange, disabled, error, hint }: ChecklistProps) {
  const id = useId();
  const selected = new Set(value);
  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} disabled={disabled}>
      <legend className={styles.label}>
        {label}
        <span className={styles.required} aria-hidden="true"> *</span>
      </legend>
      <div className={styles.chips}>
        {options.map((o) => {
          const checked = selected.has(o.value);
          return (
            <label key={o.value} className={`${styles.chip} ${checked ? styles.chipOn : ""}`}>
              <input
                type="checkbox"
                className="visually-hidden"
                checked={checked}
                onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
              />
              <span className={styles.chipMark} aria-hidden="true">
                {checked ? <Icon name="check" size={14} strokeWidth={3} /> : null}
              </span>
              {o.label}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
