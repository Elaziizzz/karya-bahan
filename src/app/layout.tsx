import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/ToastProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Karya Bahan - POS & Bookkeeping",
  description: "Production-ready bookkeeping app for Karya Bahan material store.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-[#f8f9fa] bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:16px_16px] text-black flex flex-col md:flex-row min-h-screen animate-fade-in`}>
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 h-screen overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}

