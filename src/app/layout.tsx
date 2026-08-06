import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JLB Tax & Bookkeeping — Client Portal",
  description: "Secure document upload, e-signature, and payments for JLB Tax & Bookkeeping clients.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
