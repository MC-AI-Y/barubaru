import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "WHControl | Warehouse Control YOFC",
  description: "Pelaporan stok material gudang subkontraktor YOFC.",
  applicationName: "WHControl",
  robots: { index: false, follow: false },
  icons: { icon: "/logo/yofc-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
