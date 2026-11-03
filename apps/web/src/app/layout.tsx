import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/styles/retro-theme.css";
import { SessionSyncProvider } from "@/components/SessionSyncProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Focoman",
  description: "Business operating system for photography studios",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`retro-ui ${inter.variable}`} data-ui-style="retro" suppressHydrationWarning>
      <body className={`retro-ui ${inter.className} font-sans`} suppressHydrationWarning>
        <SessionSyncProvider>
          {children}
        </SessionSyncProvider>
      </body>
    </html>
  );
}
