"use client";

import { useEffect, type ComponentType } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Stepper } from "@/components/layout/Stepper";
import { Icon } from "@/components/ui/Icon";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { ToastProvider } from "@/components/ui/Toast";
import { FlowProvider, useFlow } from "./flow";
import { ReportProvider, useReport } from "./report/ReportProvider";
import { REPORT_STEPS, reportStepIndex, VISIT_REPORT_SCREENS, type ScreenId } from "./steps";
import { HomeScreen } from "./HomeScreen";
import { VisitHomeScreen } from "./VisitHomeScreen";
import { BoqScreen, DashboardScreen, DoScreen, ToScreen } from "./FeaturePlaceholderScreen";
import { LoginScreen } from "./LoginScreen";
import { SelfiePacScreen, SelfiePaoScreen } from "./SelfieScreen";
import { GudangScreen } from "./GudangScreen";
import { MaterialScreen } from "./MaterialScreen";
import { ReviewScreen } from "./ReviewScreen";
import { SubmitScreen } from "./SubmitScreen";
import { DoneScreen } from "./DoneScreen";
import styles from "./WHControlApp.module.css";

const SCREENS: Record<ScreenId, ComponentType> = {
  home: HomeScreen,
  login: LoginScreen,
  dashboard: DashboardScreen,
  do: DoScreen,
  to: ToScreen,
  boq: BoqScreen,
  visit: VisitHomeScreen,
  pao: SelfiePaoScreen,
  gudang: GudangScreen,
  material: MaterialScreen,
  review: ReviewScreen,
  pac: SelfiePacScreen,
  submit: SubmitScreen,
  done: DoneScreen,
};

function AppFrame() {
  const { screen, direction, session, go } = useFlow();
  const { loaded, draft, update, storageError, clearLastResult, flushDraft } = useReport();
  const Screen = SCREENS[screen];

  // Layar laporan Visit butuh draf; tanpa draf (mis. setelah keluar) kembali ke Beranda.
  const needsDraft = VISIT_REPORT_SCREENS.includes(screen);
  // Semua layar selain Beranda dan Login butuh sesi.
  const needsSession = screen !== "home" && screen !== "login";
  useEffect(() => {
    if (loaded && needsDraft && (!session || !draft)) go("home");
  }, [loaded, needsDraft, session, draft, go]);
  useEffect(() => {
    if (needsSession && !session && screen !== "done") go("home");
  }, [needsSession, session, screen, go]);

  // Ingat langkah terakhir agar draf bisa dilanjutkan di langkah yang sama.
  useEffect(() => {
    if (!draft || !needsDraft) return;
    const step = screen === "submit" ? "pac" : screen;
    if (draft.step !== step) update((d) => ({ ...d, step }));
  }, [screen, draft, needsDraft, update]);
  const stepIndex = reportStepIndex(screen);
  // Halaman depan (belum login) dan Login punya logo besar sendiri; menu Beranda setelah login memakai header.
  const showHeader = screen !== "login" && (screen !== "home" || Boolean(session));

  // Logo YOFC dan nama subcont di header = kembali ke Beranda. Draf tetap tersimpan,
  // dan bisa dilanjutkan dari Beranda lewat "Lanjutkan Pengisian Form".
  // Saat laporan sedang dikirim, tombol dinonaktifkan agar pengiriman tidak terputus.
  const homeDisabled = screen === "submit";
  const goHome = () => {
    if (homeDisabled) return;
    if (screen === "done") clearLastResult();
    flushDraft(); // isian terakhir langsung tersimpan
    go("home");
  };

  return (
    <div className={styles.app}>
      {showHeader ? (
        <AppHeader
          onHome={goHome}
          homeDisabled={homeDisabled}
          right={
            session ? (
              <button
                type="button"
                className={styles.userChip}
                onClick={goHome}
                disabled={homeDisabled}
                title={homeDisabled ? "Tunggu sampai pengiriman selesai" : `${session.subcontName} · kembali ke Beranda`}
                aria-label={`${session.subcontName}, kembali ke Beranda`}
              >
                <Icon name="user" size={16} />
                <span className={styles.userName}>{session.subcontName}</span>
              </button>
            ) : null
          }
        />
      ) : null}

      {stepIndex >= 0 ? <Stepper steps={REPORT_STEPS} current={stepIndex} /> : null}

      {storageError ? (
        <div className={styles.storageWarn} role="alert">
          {storageError}
        </div>
      ) : null}

      <main className={styles.stage}>
        <div key={screen} className={`${styles.screen} ${direction === "forward" ? styles.forward : styles.back}`}>
          {needsDraft && !draft ? null : <Screen />}
        </div>
      </main>
    </div>
  );
}

export function WHControlApp() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <FlowProvider>
          <ReportProvider>
            <AppFrame />
          </ReportProvider>
        </FlowProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
