import type { Metadata, Viewport } from "next";
import { Assistant, Rubik } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Display face of the "broadcast" look: numbers, times and big titles.
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-rubik",
  weight: ["500", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "האקדמיה לסנוקר של שחר רוברג",
  description: "האקדמיה לסנוקר של שחר רוברג",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning className={`${assistant.variable} ${rubik.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
