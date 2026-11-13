import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/client/toaster";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "NEXORA", template: "%s · NEXORA" },
  description: "One connected experience. Every request accounted for.",
  applicationName: "NEXORA",
  // The share image itself is src/app/opengraph-image.png (picked up by file name).
  openGraph: {
    type: "website",
    siteName: "NEXORA",
    title: "NEXORA",
    description: "Every guest request, accounted for. Guests, staff and managers on one live system.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${jakarta.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
