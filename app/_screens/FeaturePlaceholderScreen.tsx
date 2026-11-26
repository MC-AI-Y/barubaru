"use client";

import { ScreenShell } from "@/components/layout/ScreenShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useFlow } from "./flow";
import { FEATURES, type FeatureId } from "./steps";
import { OrdersScreen } from "./OrdersScreen";
import styles from "./HubScreen.module.css";

/** Layar sementara untuk fitur Phase 2 yang belum dibangun (Dashboard). DO/TO/BOQ memakai OrdersScreen. */
function FeaturePlaceholder({ id }: { id: FeatureId }) {
  const { go } = useFlow();
  const feature = FEATURES.find((f) => f.id === id) ?? FEATURES[0];
  return (
    <ScreenShell
      centered
      eyebrow={feature.short}
      title={feature.label}
      description={`${feature.description} Fitur ini sedang disiapkan dan akan aktif di pembaruan berikutnya.`}
      leading={
        <span className={styles.placeholderIcon}>
          <Icon name={feature.icon} size={40} strokeWidth={1.8} />
        </span>
      }
      actions={
        <Button variant="secondary" icon={<Icon name="arrowLeft" />} onClick={() => go("home")}>
          Kembali ke Beranda
        </Button>
      }
    >
      <p className={styles.soon}>Sedang disiapkan</p>
    </ScreenShell>
  );
}

export { DashboardScreen } from "./DashboardScreen";
/** Tetap tersedia untuk fitur berikutnya yang belum dibangun. */
export const PlaceholderScreen = FeaturePlaceholder;
export const DoScreen = () => <OrdersScreen kind="do" />;
export const ToScreen = () => <OrdersScreen kind="to" />;
export const BoqScreen = () => <OrdersScreen kind="boq" />;
