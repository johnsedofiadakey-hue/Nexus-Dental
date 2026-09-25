import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus Dental — Modern, Patient-First Dental Care",
  description:
    "Modern dental care with clear communication, thoughtful technology, and a gentle patient-first approach. Book appointments or explore virtual care online.",
  keywords: [
    "dental care",
    "dentist",
    "dental clinic",
    "cosmetic dentistry",
    "orthodontics",
    "online consultation",
    "dental appointment",
  ],
  openGraph: {
    title: "Nexus Dental — Modern, Patient-First Dental Care",
    description: "Clear, comfortable dental care with online booking and virtual consultation support.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f9d8b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${inter.variable}`}>
      <body className="antialiased font-body">
        <QueryProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </QueryProvider>
      </body>
    </html>
  );
}
