import Link from 'next/link';

export async function Sidebar() {
  return (
    <aside className="w-64 min-h-screen border-r border-black flex flex-col justify-between bg-white relative">
      <div className="p-8 pb-4">
        <div className="mb-8 border-b-4 border-black pb-4">
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-tight mb-2 text-black break-words">
            KARYA BAHAN
          </h1>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Toko Material & Bangunan
          </div>
        </div>

        <nav className="flex flex-col gap-4">
          <Link href="/" className="text-lg font-medium hover:underline underline-offset-4 decoration-2">
            POS Dashboard
          </Link>
          <Link href="/materials" className="text-lg font-medium hover:underline underline-offset-4 decoration-2">
            Inventory / Materials
          </Link>
          <Link href="/reports" className="text-lg font-medium hover:underline underline-offset-4 decoration-2">
            Reports
          </Link>
          <Link href="/trash" className="text-lg font-medium hover:underline underline-offset-4 decoration-2 text-red-600">
            Tong Sampah
          </Link>
          <Link href="/settings" className="text-lg font-medium hover:underline underline-offset-4 decoration-2">
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
