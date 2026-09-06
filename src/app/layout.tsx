import type { Metadata } from "next";
import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import { Suspense } from "react";
import { GlobalActivityIndicator } from "@/components/global-activity-indicator";
import "./globals.css";
import "./v14-quiet.css";
import "./ui-foundation.css";
import "./compact-density.css";

const sans = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GISP — Global Interior Supply Platform",
    template: "%s | GISP",
  },
  description:
    "แพลตฟอร์มบริหารการสั่งซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีนแบบครบ Workflow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${sans.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
      data-density="compact"
    >
      <body>
        <Suspense fallback={null}>
          <GlobalActivityIndicator />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
