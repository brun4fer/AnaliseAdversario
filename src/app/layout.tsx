import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/app-shell";
import { PwaRegistrar } from "@/components/pwa-registrar";
import { APP_NAME } from "@/lib/taxonomy";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "PWA for tactical football analysis with local video.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
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
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegistrar />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
