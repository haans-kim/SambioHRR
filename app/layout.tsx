import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GridPattern } from "@/components/ui/grid-pattern";
import { DevModeProvider } from "@/contexts/DevModeContext";
import { Sidebar } from "@/components/navigation/Sidebar";
import Providers from "./providers";

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SambioHRR - 통합 HR 분석 시스템",
  description: "개인별 및 조직별 근무 데이터 통합 분석 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <DevModeProvider>
            <div className="min-h-screen bg-gray-50">
              <Sidebar />
              <main className="ml-56">
                {children}
              </main>
            </div>
          </DevModeProvider>
        </Providers>
      </body>
    </html>
  );
}
