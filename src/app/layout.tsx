import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estudi Demo",
  description: "Eines internes — versió demo",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
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
