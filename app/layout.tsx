import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "AuditScope — Audit-to-deployment coverage", template: "%s · AuditScope" },
  description: "Verify whether a published smart-contract security audit still covers the exact code running onchain today.",
  openGraph: {
    title: "AuditScope — Audited doesn't always mean covered",
    description: "AI extracts the audit scope. Deterministic evidence checks whether it still maps to the live Base deployment.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geist.variable} ${geistMono.variable}`}><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
