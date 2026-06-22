import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Knowledge Hub",
  description: "Interface locale de gestion des fiches Knowledge Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
