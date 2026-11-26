"use client";

import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { formatRegionList } from "@/lib/format/region";
import { formatQuantity, hasErrors, parseQuantity, validateGudang } from "@/lib/report/validate";
import { useFlow } from "./flow";
import { emptyForm, isFormEmpty, type MaterialEntry } from "./report/draft";
import { PhotoThumb } from "./report/shared";
import { useReport } from "./report/ReportProvider";
import styles from "./screens.module.css";

export function ReviewScreen() {
  const { go } = useFlow();
  const { draft, update, deletePhotos } = useReport();
  const confirm = useConfirm();
  const toast = useToast();
  if (!draft) return null;

  const missingPhotos = draft.materials.filter((m) => !m.photo).length;
  const g = draft.gudang;

  async function edit(entry: MaterialEntry) {
    if (!draft) return;
    if (!isFormEmpty(draft.form) && draft.form.id !== entry.id) {
      const ok = await confirm({
        title: "Ganti isi form?",
        message: "Isi form material yang belum disimpan akan dibuang.",
        confirmLabel: "Buang & edit",
        tone: "danger",
      });
      if (!ok) return;
      deletePhotos([draft.form.photo?.id]);
    }
    update((d) => ({ ...d, form: { ...entry }, editingId: entry.id }));
    go("material");
  }

  async function remove(entry: MaterialEntry, index: number) {
    const ok = await confirm({
      title: `Hapus material #${index + 1}?`,
      message: `${entry.material} (${entry.quantity} ${entry.unit}) beserta fotonya akan dihapus dari laporan.`,
      confirmLabel: "Hapus",
      tone: "danger",
    });
    if (!ok) return;
    deletePhotos([entry.photo?.id]);
    update((d) => ({ ...d, materials: d.materials.filter((m) => m.id !== entry.id) }));
  }

  function proceed() {
    if (!draft) return;
    if (!draft.pao) {
      toast.show("Selfie awal belum diambil.", "warning");
      go("pao");
      return;
    }
    if (hasErrors(validateGudang(draft.gudang))) {
      toast.show("Data gudang belum lengkap.", "warning");
      go("gudang");
      return;
    }
    if (draft.materials.length === 0) {
      toast.show("Minimal 1 material per laporan.", "warning");
      return;
    }
    if (missingPhotos > 0) {
      toast.show(`${missingPhotos} material belum punya foto. Edit material tersebut dan ambil fotonya.`, "warning");
      return;
    }
    go("pac");
  }

  function addMore() {
    if (!draft) return;
    if (draft.editingId) update((d) => ({ ...d, form: emptyForm(), editingId: null }));
    go("material");
  }

  return (
    <ScreenShell
      eyebrow="Periksa sebelum kirim"
      title="Review"
      description="Periksa seluruh material. Anda masih bisa mengedit atau menghapus sebelum submit."
      actions={
        <>
          <Button variant="secondary" icon={<Icon name="arrowLeft" />} onClick={addMore}>
            Kembali
          </Button>
          <Button icon={<Icon name="camera" />} onClick={proceed}>
            Ambil Foto Penutup &amp; Submit
          </Button>
        </>
      }
    >
      <Card>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Data Gudang</h2>
          <button type="button" className={styles.linkBtn} onClick={() => go("gudang")}>
            Lihat/ubah
          </button>
        </div>
        <dl className={styles.summary}>
          <dt>Region</dt>
          <dd>{formatRegionList(g.regions, "display") || "-"}</dd>
          <dt>Warehouse</dt>
          <dd>{g.warehouseName || "-"}</dd>
          <dt>PIC Subcont</dt>
          <dd>{g.pic || "-"}</dd>
          <dt>YOFC SPV</dt>
          <dd>{g.spv || "-"}</dd>
          <dt>YOFC PM/RPM</dt>
          <dd>{g.pm || "-"}</dd>
        </dl>
      </Card>

      <Card>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Material ({draft.materials.length})</h2>
          <button type="button" className={styles.linkBtn} onClick={addMore}>
            + Tambah
          </button>
        </div>
        {draft.materials.length === 0 ? (
          <p className={styles.hintText}>Belum ada material. Tekan &quot;+ Tambah&quot;.</p>
        ) : (
          <ul className={styles.list}>
            {draft.materials.map((m, i) => (
              <li key={m.id} className={styles.item}>
                {m.photo ? <PhotoThumb photoId={m.photo.id} alt={`Foto ${m.material}`} /> : <span className={styles.thumbPlaceholder} />}
                <div className={styles.itemBody}>
                  <span className={styles.itemTitle}>
                    #{i + 1} {m.material}
                  </span>
                  <span className={styles.itemSub}>Remark: {m.remark}</span>
                  <span className={styles.itemSub}>
                    {formatQuantity(parseQuantity(m.quantity) ?? 0)} {m.unit}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </span>
                  {!m.photo ? <span className={styles.itemWarn}>Foto perlu diambil ulang</span> : null}
                </div>
                <div className={styles.itemActions}>
                  <button type="button" className={styles.smallBtn} onClick={() => void edit(m)}>
                    Edit
                  </button>
                  <button type="button" className={`${styles.smallBtn} ${styles.smallBtnDanger}`} onClick={() => void remove(m, i)}>
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </ScreenShell>
  );
}
