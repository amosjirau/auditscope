import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditScope",
  description: "Verify whether an audit still covers the contracts running onchain.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
