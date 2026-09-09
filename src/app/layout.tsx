import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAR+ Serviços | Formação",
  description: "Atendimento, campanhas e agentes de IA da DAR+ via WhatsApp.",
  icons: {
    icon: "/brand/favicon.png",
    apple: "/brand/favicon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
