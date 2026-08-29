"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path ? "bg-black text-white px-4 py-2 font-bold translate-x-2 shadow-lg" : "text-gray-500 hover:text-black hover:bg-gray-50 px-4 py-2 font-medium hover:translate-x-1";
  };

  return (
    <aside className="w-64 min-h-screen border-r border-black flex flex-col justify-between bg-white relative hidden md:flex transition-all duration-300">
      <div className="p-8 pb-4">
        <div className="mb-8 border-b-4 border-black pb-4">
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-tight mb-2 text-black break-words group cursor-default">
            KARYA <span className="text-blue-600 transition-colors group-hover:text-black">BAHAN</span>
          </h1>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Toko Material & Bangunan
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <Link href="/" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/')}`}>
            Kasir
          </Link>
          <Link href="/restock" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/restock')}`}>
            Restock
          </Link>
          <Link href="/materials" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/materials')}`}>
            Inventory
          </Link>
          <Link href="/reports" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/reports')}`}>
            Reports
          </Link>
          <Link href="/trash" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/trash')} hover:text-red-600 hover:bg-red-50`}>
            Tong Sampah
          </Link>
          <Link href="/settings" className={`text-lg transition-swiss flex items-center gap-3 ${isActive('/settings')}`}>
            Settings
          </Link>
        </nav>
      </div>
      <div className="p-8 pt-4 border-t border-gray-200">
        <div className="text-xs font-mono uppercase tracking-widest text-gray-500">
          v1.0.0 &copy; {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
