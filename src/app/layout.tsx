import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Dupla tipográfica intencional: serifada com calor editorial nos títulos
// (remete a "Formação") + geométrica limpa no corpo (legibilidade em painel
// denso de dados). next/font baixa e hospeda os arquivos no próprio build,
// sem chamada a CDN externo em runtime.
const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap"
});

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

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
    <html lang="pt-BR" className={`${fontDisplay.variable} ${fontSans.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
