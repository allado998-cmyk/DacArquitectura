import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DacArquitectura",
  description: "Eines internes de DacArquitectura",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
