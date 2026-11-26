"use client";

import { useCallback, useEffect, useState } from "react";
import { CameraCapture, type CaptureResult } from "@/components/camera/CameraCapture";
import { watermarkLines } from "@/components/camera/watermark";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { SelectField, TextAreaField } from "@/components/ui/Fields";
import { Icon } from "@/components/ui/Icon";
import { LoadingBlock } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { NO_REMARK } from "@/lib/google/parse";
import type { CaptureContext } from "@/lib/report/types";
import {
  formatQuantity,
  formatQuantityInput,
  hasErrors,
  parseQuantity,
  validateGudang,
  validateMaterialFields,
  type MaterialFields,
} from "@/lib/report/validate";
import { useFlow } from "./flow";
import { emptyForm, formReadyForPhoto, isEntryComplete, isFormEmpty, type Draft, type MaterialEntry } from "./report/draft";
import { PhotoThumb, ReferenceError, useCaptureContext, useReportErrors } from "./report/shared";
import { useReport } from "./report/ReportProvider";
import styles from "./screens.module.css";

type LockedField = "material" | "remark" | "quantity" | "unit";


/** Foto asli milik material yang sedang diedit (jangan dihapus sebelum perubahan disimpan). */
function originalPhotoId(d: Draft): string | null {
  if (!d.editingId) return null;
  return d.materials.find((m) => m.id === d.editingId)?.photo?.id ?? null;
}

export function MaterialScreen() {
  const { go, back } = useFlow();
  const { draft, update, reference, loadReference, savePhoto, deletePhotos } = useReport();
  const confirm = useConfirm();
  const toast = useToast();
  const handleError = useReportErrors();
  const getContext = useCaptureContext();
  const [showErrors, setShowErrors] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  // Satuan selalu otomatis dari material. Draf lama (belum ada foto) disamakan otomatis.
  const autoUnit =
    reference.status === "ready" && draft ? (reference.materials.find((o) => o.name === draft.form.material)?.unit ?? "") : null;
  const needsUnitSync = autoUnit !== null && !!draft && !draft.form.photo && draft.form.unit !== autoUnit;
  useEffect(() => {
    if (needsUnitSync && autoUnit !== null) update((d) => (d.form.photo ? d : { ...d, form: { ...d.form, unit: autoUnit } }));
  }, [needsUnitSync, autoUnit, update]);

  const watermark = useCallback(
    (ctx: CaptureContext) =>
      draft
        ? watermarkLines({
            capture: ctx,
            subcontName: draft.subcontName,
            warehouseName: draft.gudang.warehouseName,
            material: draft.form.material,
            remark: draft.form.remark,
            quantity: parseQuantity(draft.form.quantity) ?? 0,
            unit: draft.form.unit.trim(),
          })
        : [],
    [draft],
  );

  if (!draft) return null;
  const options = reference.status === "ready" ? reference.materials : [];
  const f = draft.form;
  const editing = Boolean(draft.editingId);
  const errors = validateMaterialFields(f, reference.status === "ready" ? options : undefined);
  const shown = showErrors ? errors : {};
  const ready = reference.status === "ready" && formReadyForPhoto(f, options);
  const gudangOk = !hasErrors(validateGudang(draft.gudang));
  const selected = options.find((o) => o.name === f.material);
  const remarkOptions = (selected?.remarks ?? []).map((r) => ({ value: r, label: r }));
  const onlyDash = selected?.remarks.length === 1 && selected.remarks[0] === NO_REMARK;
  const fixedUnit = selected?.unit ?? "";

  /** Menghapus foto form (blob dihapus kecuali milik material asli yang sedang diedit). */
  function dropFormPhoto(d: Draft) {
    const id = d.form.photo?.id;
    if (id && id !== originalPhotoId(d)) deletePhotos([id]);
  }

  async function setField(field: keyof MaterialFields, value: string) {
    if (!draft) return;
    const isLocked = (["material", "remark", "quantity", "unit"] as LockedField[]).includes(field as LockedField);
    let clearPhoto = false;
    if (isLocked && draft.form.photo && draft.form[field] !== value) {
      const ok = await confirm({
        title: "Ubah data material?",
        message: "Data ini sudah tercetak di watermark foto. Bila diubah, foto akan dihapus dan harus diambil ulang.",
        confirmLabel: "Ubah & hapus foto",
        tone: "danger",
      });
      if (!ok) return;
      clearPhoto = true;
      dropFormPhoto(draft);
    }
    update((d) => {
      const form = { ...d.form, [field]: value };
      if (field === "material") {
        const opt = options.find((o) => o.name === value);
        const remarks = opt?.remarks ?? [];
        form.remark = remarks.length === 1 && remarks[0] === NO_REMARK ? NO_REMARK : remarks.includes(d.form.remark) ? d.form.remark : "";
        // Satuan otomatis mengikuti material ("M" untuk kabel/HDPE, selain itu "Pcs").
        form.unit = opt?.unit ?? "";
      }
      if (clearPhoto) form.photo = null;
      return { ...d, form };
    });
  }

  async function handleUse(result: CaptureResult) {
    const ref = await savePhoto({ full: result.full, thumb: result.thumb, ref: { capture: result.capture, width: result.width, height: result.height } });
    if (draft) dropFormPhoto(draft);
    update((d) => ({ ...d, form: { ...d.form, photo: ref } }));
    setCameraOpen(false);
  }

  /** Menyimpan form ke daftar. Mengembalikan false bila belum lengkap. */
  function commit(silent = false): boolean {
    if (!draft) return false;
    if (!isEntryComplete(f, options)) {
      setShowErrors(true);
      if (!hasErrors(errors) && !f.photo) toast.show("Ambil foto material terlebih dahulu.", "warning");
      return false;
    }
    const entry: MaterialEntry = { ...f, quantity: f.quantity.trim(), unit: f.unit.trim(), notes: f.notes.trim() };
    const original = originalPhotoId(draft);
    if (original && original !== entry.photo?.id) deletePhotos([original]);
    const position = editing ? draft.materials.findIndex((m) => m.id === draft.editingId) + 1 : draft.materials.length + 1;
    update((d) => ({
      ...d,
      materials: d.editingId ? d.materials.map((m) => (m.id === d.editingId ? entry : m)) : [...d.materials, entry],
      form: emptyForm(),
      editingId: null,
    }));
    setShowErrors(false);
    if (!silent) toast.show(editing ? `Material #${position} diperbarui.` : `Material #${position} tersimpan. Silakan isi material berikutnya.`, "success");
    return true;
  }

  function addAnother() {
    if (isFormEmpty(f)) {
      toast.show("Form material masih kosong.", "info");
      return;
    }
    commit();
  }

  async function toReview() {
    if (!draft) return;
    if (editing) {
      if (commit(true)) go("review");
      return;
    }
    if (!isFormEmpty(f)) {
      if (isEntryComplete(f, options)) {
        commit(true);
        go("review");
        return;
      }
      const ok = await confirm({
        title: "Material belum lengkap",
        message: "Material yang sedang diisi belum lengkap dan tidak akan disimpan. Lanjut ke Review?",
        confirmLabel: "Buang & lanjut",
        tone: "danger",
      });
      if (!ok) return;
      dropFormPhoto(draft);
      update((d) => ({ ...d, form: emptyForm() }));
    }
    if (draft.materials.length === 0) {
      toast.show("Minimal 1 material per laporan.", "warning");
      return;
    }
    go("review");
  }

  async function cancelEdit() {
    if (!draft) return;
    dropFormPhoto(draft);
    update((d) => ({ ...d, form: emptyForm(), editingId: null }));
    setShowErrors(false);
    go("review");
  }

  async function editEntry(entry: MaterialEntry) {
    if (!draft) return;
    if (!isFormEmpty(draft.form) && draft.form.id !== entry.id) {
      const ok = await confirm({
        title: "Ganti isi form?",
        message: "Isi form material yang sedang diisi akan dibuang.",
        confirmLabel: "Buang & edit",
        tone: "danger",
      });
      if (!ok) return;
      dropFormPhoto(draft);
    }
    update((d) => ({ ...d, form: { ...entry }, editingId: entry.id }));
    setCartOpen(false);
    setShowErrors(false);
  }

  async function removeEntry(entry: MaterialEntry, index: number) {
    const ok = await confirm({
      title: `Hapus material #${index + 1}?`,
      message: `${entry.material} (${entry.quantity} ${entry.unit}) beserta fotonya akan dihapus dari laporan.`,
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ok) return;
    deletePhotos([entry.photo?.id]);
    update((d) => ({
      ...d,
      materials: d.materials.filter((m) => m.id !== entry.id),
      ...(d.editingId === entry.id ? { form: emptyForm(), editingId: null } : {}),
    }));
  }

  return (
    <>
      <ScreenShell
        eyebrow="1 material = 1 foto"
        title={editing ? "Edit Material" : "Material"}
        description="Isi material, remark, quantity, dan satuan, lalu ambil foto landscape berwatermark."
        actions={
          editing ? (
            <>
              <Button variant="secondary" onClick={cancelEdit}>
                Batal
              </Button>
              <Button variant="success" icon={<Icon name="check" />} onClick={toReview}>
                Simpan Perubahan
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" icon={<Icon name="arrowLeft" />} onClick={back}>
                Kembali
              </Button>
              <Button variant="secondary" icon={<Icon name="plus" />} onClick={addAnother}>
                Material
              </Button>
              <Button icon={<Icon name="list" />} onClick={toReview}>
                Review
              </Button>
            </>
          )
        }
      >
        <div className={styles.toolbar}>
          <button type="button" className={styles.cartBtn} onClick={() => setCartOpen(true)} aria-label={`Daftar material sementara, ${draft.materials.length} item`}>
            <Icon name="box" size={18} />
            Daftar
            <span className={styles.badge}>{draft.materials.length}</span>
          </button>
          {editing ? <span className={styles.editTag}>Mengedit material</span> : null}
        </div>

        {!gudangOk ? (
          <div className={styles.formError} role="alert">
            <Icon name="alert" size={18} />
            <span>Data gudang belum lengkap. Kembali ke langkah Data Gudang.</span>
          </div>
        ) : null}

        <Card accent="green">
          {reference.status === "ready" ? (
            <div className={styles.form}>
              <SelectField
                label="Material"
                requiredMark
                placeholder="Pilih material"
                options={options.map((o) => ({ value: o.name, label: o.name }))}
                value={f.material}
                onChange={(e) => void setField("material", e.target.value)}
                error={shown.material}
              />
              <SelectField
                label="Remark"
                requiredMark
                placeholder={f.material ? "Pilih remark" : "Pilih material dulu"}
                options={remarkOptions}
                value={f.remark}
                onChange={(e) => void setField("remark", e.target.value)}
                disabled={!f.material || onlyDash}
                hint={onlyDash ? 'Material ini tidak punya pilihan remark, otomatis "-".' : undefined}
                error={shown.remark}
              />
              <div className={styles.grid2}>
                <TextField
                  label="Quantity"
                  requiredMark
                  inputMode="numeric"
                  placeholder="Contoh: 1200"
                  value={f.quantity}
                  onChange={(e) => void setField("quantity", formatQuantityInput(e.target.value))}
                  error={shown.quantity}
                  hint="Angka saja, tanpa titik atau koma."
                  autoComplete="off"
                  maxLength={8}
                />
                <SelectField
                  label="Satuan"
                  requiredMark
                  placeholder="Otomatis"
                  options={fixedUnit ? [{ value: fixedUnit, label: fixedUnit }] : []}
                  value={fixedUnit}
                  onChange={() => undefined}
                  disabled
                  hint={fixedUnit ? "Otomatis sesuai material." : "Terisi otomatis setelah material dipilih."}
                  error={shown.unit}
                />
              </div>

              <div className={styles.photoSlot}>
                <span className={styles.metaRow} style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>
                  Foto material <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                {f.photo ? (
                  <>
                    <PhotoThumb photoId={f.photo.id} kind="full" alt="Foto material berwatermark" className={styles.photoSlotImg} />
                    <Button variant="secondary" icon={<Icon name="camera" />} onClick={() => setCameraOpen(true)}>
                      Ambil Ulang Foto
                    </Button>
                  </>
                ) : (
                  <>
                    <Button icon={<Icon name="camera" />} disabled={!ready || !gudangOk} onClick={() => setCameraOpen(true)} block>
                      Ambil Foto Material
                    </Button>
                    <p className={styles.hintText}>
                      {ready ? "Putar HP ke landscape. Watermark ditambahkan otomatis." : "Lengkapi Material, Remark, Quantity, dan Satuan untuk mengaktifkan kamera."}
                    </p>
                  </>
                )}
                {showErrors && !f.photo && !hasErrors(errors) ? <p className={styles.itemWarn}>Foto material wajib diambil.</p> : null}
              </div>

              <TextAreaField
                label="Notes (opsional)"
                value={f.notes}
                onChange={(e) => void setField("notes", e.target.value)}
                maxLength={300}
                error={shown.notes}
                rows={3}
              />
            </div>
          ) : reference.status === "error" ? (
            <ReferenceError message={reference.message} onRetry={loadReference} />
          ) : (
            <LoadingBlock text="Memuat daftar material…" />
          )}
        </Card>
      </ScreenShell>

      <BottomSheet open={cartOpen} title={`Daftar Material (${draft.materials.length})`} onClose={() => setCartOpen(false)}>
        {draft.materials.length === 0 ? (
          <p className={styles.hintText}>Belum ada material tersimpan. Isi form lalu tekan &quot;+ Material&quot;.</p>
        ) : (
          <ul className={styles.list}>
            {draft.materials.map((m, i) => (
              <li key={m.id} className={styles.item}>
                {m.photo ? <PhotoThumb photoId={m.photo.id} alt={`Foto ${m.material}`} /> : <span className={styles.thumbPlaceholder} />}
                <div className={styles.itemBody}>
                  <span className={styles.itemTitle}>
                    #{i + 1} {m.material}
                  </span>
                  <span className={styles.itemSub}>
                    {m.remark} · {formatQuantity(parseQuantity(m.quantity) ?? 0)} {m.unit}
                  </span>
                  {!m.photo ? <span className={styles.itemWarn}>Foto perlu diambil ulang</span> : null}
                </div>
                <div className={styles.itemActions}>
                  <button type="button" className={styles.smallBtn} onClick={() => void editEntry(m)}>
                    Edit
                  </button>
                  <button type="button" className={`${styles.smallBtn} ${styles.smallBtnDanger}`} onClick={() => void removeEntry(m, i)}>
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

      {cameraOpen ? (
        <CameraCapture
          mode="material"
          title={`Foto ${f.material}`}
          getContext={getContext}
          watermark={watermark}
          onUse={handleUse}
          onClose={() => setCameraOpen(false)}
          onError={handleError}
        />
      ) : null}
    </>
  );
}
