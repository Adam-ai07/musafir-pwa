import type { Metadata, Viewport } from "next";
import { Amiri, Inter } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import FeedbackWidget from "@/components/FeedbackWidget";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SettingsProvider } from "@/src/context/SettingsContext";
import "./globals.css";

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "مُسَافِر — Путник в этом мире",
  description: "مُسَافِر (Путник в этом мире) — время намаза, Коран, азкары и хадисы",
  applicationName: "Musafir",
  manifest: `${basePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    title: "Musafir",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${basePath}/icon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  other: {
    // Явно — новые версии Next выводят только mobile-web-app-capable
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${amiri.variable} ${inter.variable} dark`}>
      <body className="min-h-dvh font-sans antialiased transition-colors">
        <SettingsProvider>
          <ServiceWorkerRegister />
          <div className="mx-auto min-h-dvh w-full max-w-md pb-[calc(5rem+env(safe-area-inset-bottom))] pt-safe">
            {children}
          </div>
          <FeedbackWidget />
          <BottomNav />
        </SettingsProvider>
      </body>
    </html>
  );
}
