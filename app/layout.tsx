import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar — Ecommerce Profitability",
  description: "Amazon and DTC profitability analytics case study",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

