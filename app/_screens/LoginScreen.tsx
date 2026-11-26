"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PasswordField, TextField } from "@/components/ui/TextField";
import { authApi } from "./api";
import { useFlow } from "./flow";
import styles from "./LoginScreen.module.css";

interface FieldErrors {
  subcontName?: string;
  password?: string;
}

/** Gelembung dekoratif (sama gayanya dengan Beranda). */
const BUBBLES = [
  { tone: "pink", size: 110, top: "4%", left: "-40px" },
  { tone: "orange", size: 54, top: "14%", left: "82%" },
  { tone: "green", size: 80, top: "78%", left: "86%" },
  { tone: "blue", size: 140, top: "86%", left: "-52px" },
] as const;

/**
 * Login: Subcont Name dan password diketik manual (tanpa daftar pencarian),
 * diverifikasi di server. Pesan gagal sengaja umum.
 * Tata letak: kartu di tengah layar (HP, tablet, laptop).
 */
export function LoginScreen() {
  const { go, signIn } = useFlow();
  const [subcontName, setSubcontName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Fokus ke judul (bukan input) agar keyboard HP tidak langsung menutupi layar.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const next: FieldErrors = {};
    if (!subcontName.trim()) next.subcontName = "Subcont wajib diisi.";
    if (!password) next.password = "Password wajib diisi.";
    setFieldErrors(next);
    setFormError(null);
    if (next.subcontName || next.password) return;

    setLoading(true);
    const res = await authApi.login(subcontName, password);
    setLoading(false);

    if (res.ok) {
      setPassword("");
      signIn({ subcontName: res.data.subcontName, role: res.data.role === "admin" ? "admin" : "subcont" });
      return;
    }

    // 401: pesan umum dari server ("Subcont atau password salah").
    // 429: terlalu banyak percobaan. Lainnya: gangguan layanan/jaringan.
    setFormError(res.message);
    if (res.status === 401) {
      setPassword("");
      passwordRef.current?.focus();
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bubbles} aria-hidden="true">
        {BUBBLES.map((b, i) => (
          <span key={i} className={`${styles.bubble} ${styles[b.tone]}`} style={{ width: b.size, height: b.size, top: b.top, left: b.left }} />
        ))}
      </div>

      <div className={styles.scroll}>
        <div className={styles.panel}>
          <div className={styles.head}>
            <BrandLogo height={52} priority />
            <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
              Masuk
            </h1>
            <p className={styles.subtitle}>Ketik nama Subcont dan password persis seperti yang diberikan YOFC.</p>
          </div>

          <form className={styles.card} onSubmit={handleSubmit} noValidate>
            {formError ? (
              <div className={styles.formError} role="alert">
                <Icon name="alert" size={18} />
                <span>{formError}</span>
              </div>
            ) : null}

            <TextField
              label="Subcont"
              name="subcontName"
              requiredMark
              placeholder="Contoh: PT Nama Perusahaan"
              value={subcontName}
              onChange={(e) => setSubcontName(e.target.value)}
              error={fieldErrors.subcontName}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={120}
            />
            <PasswordField
              ref={passwordRef}
              label="Password"
              name="password"
              requiredMark
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              hint="Password membedakan huruf besar dan kecil."
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={120}
            />

            <Button type="submit" block loading={loading} icon={<Icon name="login" />}>
              Masuk
            </Button>
          </form>

          <button type="button" className={styles.backLink} onClick={() => go("home")} disabled={loading}>
            <Icon name="arrowLeft" size={16} />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    </div>
  );
}
