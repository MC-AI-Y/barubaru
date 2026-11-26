"use client";

import { useEffect, useState } from "react";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Fields";
import { Icon } from "@/components/ui/Icon";
import { LoadingBlock } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { useConfirm } from "@/components/ui/Confirm";
import { orderByDatabase } from "@/lib/format/region";
import { subcontCityOf } from "@/lib/report/rows";
import { hasErrors, validateGudang, type GudangErrors } from "@/lib/report/validate";
import type { GudangData } from "@/lib/report/types";
import { useFlow } from "./flow";
import { gudangLocked } from "./report/draft";
import { ReferenceError } from "./report/shared";
import { useReport } from "./report/ReportProvider";
import styles from "./screens.module.css";

export function GudangScreen() {
  const { go, back, session } = useFlow();
  const { draft, update, reference, loadReference, deletePhotos } = useReport();
  const confirm = useConfirm();
  const [showErrors, setShowErrors] = useState(false);

  // Akun dengan satu kota: kota langsung terpilih.
  const onlyCity = reference.status === "ready" && reference.cities.length === 1 ? reference.cities[0]!.value : null;
  const noCity = draft ? draft.gudang.regions.length === 0 && !gudangLocked(draft) : false;
  useEffect(() => {
    if (onlyCity && noCity) update((d) => ({ ...d, gudang: { ...d.gudang, regions: [onlyCity] } }));
  }, [onlyCity, noCity, update]);

  if (!draft) return null;

  const g = draft.gudang;
  const locked = gudangLocked(draft);
  const cities = reference.status === "ready" ? reference.cities : [];
  const errors: GudangErrors = validateGudang(g, reference.status === "ready" ? cities.map((c) => c.value) : undefined);
  const shown = showErrors ? errors : {};

  const set = <K extends keyof GudangData>(key: K, value: GudangData[K]) => update((d) => ({ ...d, gudang: { ...d.gudang, [key]: value } }));

  async function unlock() {
    const ok = await confirm({
      title: "Ubah data gudang?",
      message:
        "Data gudang sudah tercetak di watermark foto material. Untuk mengubahnya, SEMUA foto material akan dihapus dan harus diambil ulang. Data material lain tetap tersimpan.",
      confirmLabel: "Hapus foto & ubah",
      tone: "danger",
    });
    if (!ok || !draft) return;
    const ids = [draft.form.photo?.id, ...draft.materials.map((m) => m.photo?.id)];
    update((d) => ({ ...d, form: { ...d.form, photo: null }, materials: d.materials.map((m) => ({ ...m, photo: null })) }));
    deletePhotos(ids);
  }

  function next() {
    setShowErrors(true);
    if (hasErrors(errors) || reference.status !== "ready") return;
    update((d) => ({ ...d, gudang: { ...d.gudang, regions: orderByDatabase(d.gudang.regions, cities.map((c) => c.value)) } }));
    go("material");
  }

  return (
    <ScreenShell
      eyebrow="Diisi sekali per laporan"
      title="Data Gudang"
      description="Pilih kota gudang lalu isi data gudang serta penanggung jawab. Satu laporan untuk satu gudang di satu kota. Semua field wajib."
      actions={
        <>
          <Button variant="secondary" icon={<Icon name="arrowLeft" />} onClick={back}>
            Kembali
          </Button>
          <Button icon={<Icon name="arrowRight" />} onClick={next} disabled={reference.status !== "ready"}>
            Lanjut
          </Button>
        </>
      }
    >
      {locked ? (
        <div className={styles.banner} role="status">
          <Icon name="lock" size={18} />
          <div className={styles.bannerBody}>
            <span>Data gudang terkunci karena foto material sudah diambil (data ini tercetak di watermark).</span>
            <button type="button" className={styles.linkBtn} onClick={unlock}>
              Ubah data gudang
            </button>
          </div>
        </div>
      ) : null}

      <Card accent="orange">
        <div className={styles.form}>
          {reference.status === "loading" || reference.status === "idle" ? <LoadingBlock text="Memuat daftar kota…" /> : null}
          {reference.status === "error" ? <ReferenceError message={reference.message} onRetry={loadReference} /> : null}
          {reference.status === "ready" ? (
            cities.length === 0 ? (
              <div className={styles.formError} role="alert">
                <Icon name="alert" size={18} />
                <span>Akun ini belum memiliki kota di database &quot;Subcont and City Area&quot;. Hubungi admin YOFC.</span>
              </div>
            ) : (
              <SelectField
                label="Kota gudang"
                requiredMark
                options={cities}
                placeholder="Pilih kota"
                value={g.regions.length === 1 ? g.regions[0] : ""}
                onChange={(e) => set("regions", e.target.value ? [e.target.value] : [])}
                disabled={locked}
                error={shown.regions ?? (g.regions.length > 1 ? "Satu laporan hanya untuk satu kota. Pilih salah satu." : undefined)}
                hint={
                  g.regions.length === 1 && session
                    ? `Subcont City: ${subcontCityOf(session.subcontName, g.regions[0] ?? "")}`
                    : "Stok laporan ini dihitung sebagai stok aktual kota yang dipilih di Dashboard."
                }
              />
            )
          ) : null}

          <TextField
            label="Warehouse Name"
            requiredMark
            value={g.warehouseName}
            onChange={(e) => set("warehouseName", e.target.value)}
            error={shown.warehouseName}
            disabled={locked}
            maxLength={120}
            autoComplete="off"
          />
          <div className={styles.grid2}>
            <TextField
              label="PIC Subcont"
              requiredMark
              placeholder="Nama PIC"
              hint="Nama PIC saja (tanpa nomor telepon)."
              value={g.pic}
              onChange={(e) => set("pic", e.target.value)}
              error={shown.pic}
              disabled={locked}
              maxLength={120}
              autoComplete="off"
            />
            <TextField
              label="YOFC SPV"
              requiredMark
              value={g.spv}
              onChange={(e) => set("spv", e.target.value)}
              error={shown.spv}
              disabled={locked}
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <TextField
            label="YOFC PM/RPM"
            requiredMark
            value={g.pm}
            onChange={(e) => set("pm", e.target.value)}
            error={shown.pm}
            disabled={locked}
            maxLength={120}
            autoComplete="off"
          />
        </div>
      </Card>
    </ScreenShell>
  );
}
