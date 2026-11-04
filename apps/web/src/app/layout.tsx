import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/styles/retro-theme.css";
import { SessionSyncProvider } from "@/components/SessionSyncProvider";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#18181B" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Focoman Studios",
    template: "%s | Focoman Studios",
  },
  description: "Business operating system for photography and cinematography studios.",
  applicationName: "Focoman Studios",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Focoman Studios",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-white-192.png", media: "(prefers-color-scheme: light)", type: "image/png" },
      { url: "/icons/icon-dark-192.png", media: "(prefers-color-scheme: dark)", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: [
      { url: "/icons/apple-touch-icon-white.png", media: "(prefers-color-scheme: light)", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon-dark.png", media: "(prefers-color-scheme: dark)", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`retro-ui ${inter.variable}`} data-ui-style="retro" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon-white-192.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/icons/icon-dark-192.png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className={`retro-ui ${inter.className} font-sans`} suppressHydrationWarning>
        <SessionSyncProvider>
          {children}
        </SessionSyncProvider>
        <PwaRegister />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
