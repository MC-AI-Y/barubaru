"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
import styles from "./SearchSelect.module.css";

/** Pencocokan longgar: huruf besar/kecil dan spasi berlebih diabaikan. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface SearchSelectProps {
  /** Nilai terpilih; "" = semua (tanpa filter). */
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  /** Teks pilihan kosong, mis. "Semua material". */
  allLabel: string;
  /** Label untuk pembaca layar (juga dipakai uji otomatis). */
  ariaLabel: string;
  placeholder?: string;
}

/**
 * Dropdown yang bisa diketik (combobox). Daftar langsung tersaring sejak 1 huruf;
 * pilihan tetap bisa diklik. Keyboard: ↑ ↓ memilih, Enter memakai, Esc menutup.
 */
export function SearchSelect({ value, options, onChange, allLabel, ariaLabel, placeholder }: SearchSelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState(0);

  // Teks kotak mengikuti nilai terpilih selama pengguna tidak sedang mengetik.
  useEffect(() => {
    if (!typing) setText(value);
  }, [value, typing]);

  const q = typing ? norm(text) : "";
  /** Baris daftar: "" = pilihan "Semua …" (hanya tampil saat tidak menyaring). */
  const items = useMemo(() => {
    const hits = q ? options.filter((o) => norm(o).includes(q)) : [...options];
    return q ? hits : ["", ...hits];
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const i = typing ? 0 : Math.max(0, items.indexOf(value));
    setActive(i);
  }, [open, typing, items, value]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Tutup bila klik di luar.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  function close() {
    setOpen(false);
    setTyping(false);
    setText(value);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setTyping(false);
    setText(v);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (items.length ? (a + d + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      if (open && items.length) {
        e.preventDefault();
        pick(items[Math.min(active, items.length - 1)]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Tab") {
      if (open) close();
    }
  }

  const highlight = (label: string) => {
    if (!q) return label;
    const i = norm(label).indexOf(q);
    // norm() bisa mengubah panjang bila ada spasi ganda; tampilkan polos bila posisi tidak cocok.
    if (i < 0 || label.toLowerCase().slice(i, i + q.length) !== q) return label;
    return (
      <>
        {label.slice(0, i)}
        <mark className={styles.mark}>{label.slice(i, i + q.length)}</mark>
        {label.slice(i + q.length)}
      </>
    );
  };

  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div ref={rootRef} className={`${styles.root} ${open ? styles.open : ""}`}>
      <Icon name="search" size={16} className={styles.lead} />
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items.length ? optionId(active) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={value ? undefined : placeholder ?? allLabel}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setTyping(true);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.currentTarget.select();
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {value ? (
        <button
          type="button"
          className={styles.clear}
          aria-label={`Hapus pilihan ${ariaLabel}`}
          onClick={() => {
            pick("");
            inputRef.current?.focus();
          }}
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className={styles.toggle}
        onClick={() => {
          if (open) close();
          else {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <Icon name="chevronDown" size={16} />
      </button>
      {open ? (
        <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className={styles.list}>
          {items.length === 0 ? (
            <li className={styles.none} role="presentation">
              Tidak ada yang cocok
            </li>
          ) : (
            items.map((o, i) => (
              <li
                key={o || "__all"}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={o === value}
                className={`${styles.option} ${i === active ? styles.active : ""} ${o === value ? styles.selected : ""} ${o ? "" : styles.allOpt}`}
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span className={styles.optText}>{o ? highlight(o) : allLabel}</span>
                {o === value ? <Icon name="check" size={14} /> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
