import "./globals.css";

import { Albert_Sans, Inter } from "next/font/google";
import Providers from "./providers"; // client wrapper

const albert = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-albert",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${albert.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-[#F7F3EB] text-[#201909] [font-family:var(--font-albert),system-ui,-apple-system,Segoe_UI,Roboto,Arial]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
