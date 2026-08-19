import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Studio Ondare",
  description: "Gestão de tarefas e clientes do Studio Ondare",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="watermark" aria-hidden="true" />
        <div className="app-content flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
