import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Flashcard Engine",
  description: "Convert large PDFs into high-quality, concept-driven flashcards."
};

import { Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit", 
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 antialiased transition-colors relative overflow-x-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

