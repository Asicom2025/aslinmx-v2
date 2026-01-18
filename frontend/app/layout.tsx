/**
 * Layout raíz de la aplicación
 * Define la estructura HTML base y providers globales
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import ClientLayout from "@/components/ClientLayout";
import RecaptchaScript from "@/components/RecaptchaScript";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aslin 2.0 - Sistema de Gestión",
  description: "Sistema modular de gestión administrativa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <RecaptchaScript />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
