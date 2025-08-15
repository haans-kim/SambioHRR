import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GridPattern } from "@/components/ui/grid-pattern";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HR Dashboard",
  description: "조직별 근무 데이터 분석 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
