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
        <div className="relative min-h-screen bg-white dark:bg-neutral-950">
          <GridPattern
            width={40}
            height={40}
            className="opacity-[0.02]"
            strokeDasharray="4 4"
          />
          <div className="relative z-10">
            <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  <h1 className="text-xl font-bold">HR Dashboard</h1>
                </div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
