import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VibeShift - つくる速さはそのまま、壊れない開発へ",
  description: "バイブコーディングを運営できる開発に。要求・要件・仕様のトレーサビリティをグラフィカルに管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <body className="bg-[var(--bg-base)] text-[var(--text-primary)] antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
