import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/app-shell";
import { PwaRegistrar } from "@/components/pwa-registrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Análise Adversário",
  description: "PWA para análise tática de futebol com vídeo local.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Análise Adversário",
  },
};

export const viewport: Viewport = {
  themeColor: "#061111",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegistrar />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
