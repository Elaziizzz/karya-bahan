"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format, differenceInDays } from "date-fns";
import { Trash2, RefreshCcw, AlertTriangle } from "lucide-react";

// Removed getCookie

type Transaction = {
  id: string;
  material_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  total_price: number;
  created_at: string;
  deleted_at: string | null;
  materials?: {
    name: string;
  };
};

export default function TrashPage() {
  const [trashed, setTrashed] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStore] = useState("karya_bahan");

  useEffect(() => {
    fetchAndCleanTrash("karya_bahan");
  }, []);

  async function fetchAndCleanTrash(store: string) {
    setLoading(true);
    
    // 1. Auto-delete items older than 10 days
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    // We execute a delete query for anything where deleted_at < tenDaysAgo
    // We only clean for the active store to avoid cross-store interference
    await supabase
      .from("transactions")
      .delete()
      .eq("store", store)
      .not("deleted_at", "is", null)
      .lt("deleted_at", tenDaysAgo.toISOString());

    // 2. Fetch remaining trashed items
    const { data } = await supabase
      .from("transactions")
      .select("*, materials(name)")
      .eq("store", store)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (data) setTrashed(data as Transaction[]);
    setLoading(false);
  }

  async function handleRestore(id: string) {
    if (!confirm("Kembalikan transaksi ini ke riwayat aktif? (Stok akan disesuaikan kembali)")) return;
    
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .eq("id", id);
      
    if (error) {
      alert("Error restore: " + error.message);
    } else {
      fetchAndCleanTrash(activeStore); // Refresh list
    }
  }

  async function handleHardDelete(id: string) {
    if (!confirm("PERINGATAN: Transaksi ini akan dihapus secara PERMANEN dan tidak dapat dikembalikan. Lanjutkan?")) return;
    
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
      
    if (error) {
      alert("Error hapus permanen: " + error.message);
    } else {
      fetchAndCleanTrash(activeStore); // Refresh list
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b-2 border-red-600 pb-4 text-red-600">
        <Trash2 className="w-8 h-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Tong Sampah</h1>
      </div>

      <div className="bg-red-50 border border-red-200 p-4 flex gap-3 text-red-800 text-sm">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p>
          <strong>PENTING:</strong> Riwayat transaksi yang ada di sini adalah transaksi yang sudah "dibatalkan". 
          Stok material sudah dikembalikan otomatis saat dimasukkan ke tong sampah. 
          Riwayat di sini akan <strong>hilang secara permanen otomatis setelah 10 hari</strong>.
        </p>
      </div>

      <div className="border border-black bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 uppercase tracking-wide border-b border-black">
                <th className="p-4 font-bold">Waktu Dihapus</th>
                <th className="p-4 font-bold">Detail Transaksi</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500 font-bold uppercase animate-pulse">
                    Membuka Tong Sampah...
                  </td>
                </tr>
              ) : trashed.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-400 italic">
                    Tong sampah kosong.
                  </td>
                </tr>
              ) : (
                trashed.map((t) => {
                  const deletedDate = t.deleted_at ? new Date(t.deleted_at) : new Date();
                  const daysLeft = 10 - differenceInDays(new Date(), deletedDate);
                  
                  return (
                    <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-bold">{format(deletedDate, "dd MMM yyyy")}</div>
                        <div className="text-xs text-red-500 mt-1">Hilang permanen dalam {daysLeft} hari</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold">{t.materials?.name || "Material Terhapus"}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {t.type === 'IN' ? 'BELI' : 'JUAL'} {t.quantity} unit | Rp {t.total_price.toLocaleString("id-ID")}
                        </div>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => handleRestore(t.id)}
                          className="bg-black text-white px-3 py-2 text-xs font-bold uppercase hover:bg-gray-800 transition-colors inline-flex items-center gap-1"
                        >
                          <RefreshCcw className="w-3 h-3" /> Restore
                        </button>
                        <button 
                          onClick={() => handleHardDelete(t.id)}
                          className="bg-red-600 text-white px-3 py-2 text-xs font-bold uppercase hover:bg-red-800 transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus Permanen
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
