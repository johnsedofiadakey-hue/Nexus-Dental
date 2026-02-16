import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
  title: "Nexus Dental — World-Class Dental Care. Exceptional Smiles.",
  description:
    "Modern, painless dentistry delivered with precision, comfort, and care. Book appointments, consult online, and experience world-class dental services.",
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
    title: "Nexus Dental — World-Class Dental Care",
    description: "Modern, painless dentistry delivered with precision, comfort, and care.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${inter.variable}`}>
      <body className="antialiased font-body">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
