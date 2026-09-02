"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, PackagePlus, Box, BarChart2, Trash2, Settings } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path ? "bg-black text-white px-4 py-2 font-bold translate-x-2 shadow-[4px_4px_0_0_#3b82f6] rounded-md" : "text-gray-500 hover:text-black hover:bg-gray-50 px-4 py-2 font-medium hover:translate-x-1";
  };
  
  const isMobileActive = (path: string) => {
    return pathname === path ? "text-black scale-110 font-bold" : "text-gray-400";
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden w-full bg-white border-b-2 border-black p-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-black tracking-tighter uppercase text-black">KARYA BAHAN <span className="text-blue-600">JAYA PLAFON</span></h1>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 min-h-screen border-r border-black flex-col justify-between bg-white relative hidden md:flex transition-all duration-300">
        <div className="p-8 pb-4">
          <div className="mb-8 border-b-4 border-black pb-4">
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-tight mb-2 text-black break-words group cursor-default">KARYA BAHAN <span className="text-blue-600 transition-colors group-hover:text-black">JAYA PLAFON</span></h1><div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Toko Material & Bangunan</div>
          </div>

          <nav className="flex flex-col gap-2">
            <Link href="/" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/')}`}>
              <ShoppingCart size={20} /> Kasir
            </Link>
            <Link href="/restock" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/restock')}`}>
              <PackagePlus size={20} /> Restock
            </Link>
            <Link href="/materials" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/materials')}`}>
              <Box size={20} /> Inventory
            </Link>
            <Link href="/reports" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/reports')}`}>
              <BarChart2 size={20} /> Reports
            </Link>
            <Link href="/trash" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/trash')} hover:text-red-600 hover:bg-red-50`}>
              <Trash2 size={20} /> Tong Sampah
            </Link>
            <Link href="/settings" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/settings')}`}>
              <Settings size={20} /> Settings
            </Link>
          </nav>
        </div>
        <div className="p-8 pt-4 border-t border-gray-200">
          <div className="text-xs font-mono uppercase tracking-widest text-gray-500">
            v1.0.0 &copy; {new Date().getFullYear()}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t-2 border-black z-50 flex justify-around items-center p-2 pb-safe shadow-[0_-4px_0_0_rgba(0,0,0,0.1)]">
        <Link href="/" className={`flex flex-col items-center p-2 transition-all ${isMobileActive('/')}`}>
          <ShoppingCart size={24} />
          <span className="text-[10px] mt-1 uppercase tracking-wider">Kasir</span>
        </Link>
        <Link href="/restock" className={`flex flex-col items-center p-2 transition-all ${isMobileActive('/restock')}`}>
          <PackagePlus size={24} />
          <span className="text-[10px] mt-1 uppercase tracking-wider">Restock</span>
        </Link>
        <Link href="/materials" className={`flex flex-col items-center p-2 transition-all ${isMobileActive('/materials')}`}>
          <Box size={24} />
          <span className="text-[10px] mt-1 uppercase tracking-wider">Stock</span>
        </Link>
        <Link href="/reports" className={`flex flex-col items-center p-2 transition-all ${isMobileActive('/reports')}`}>
          <BarChart2 size={24} />
          <span className="text-[10px] mt-1 uppercase tracking-wider">Laporan</span>
        </Link>
      </nav>
    </>
  );
}

