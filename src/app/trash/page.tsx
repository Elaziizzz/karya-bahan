"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format, differenceInDays } from "date-fns";
import { Trash2, RefreshCcw, AlertTriangle, Calendar, Clock, User, Package } from "lucide-react";

type Transaction = {
  id: string;
  material_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  total_price: number;
  created_at: string;
  deleted_at: string | null;
  customer_name?: string;
  customer_phone?: string;
  payment_status?: string;
  dp_amount?: number;
  materials?: {
    name: string;
    code?: string;
  };
};

type TrashedNota = {
  key: string;
  type: 'IN' | 'OUT';
  created_at: string;
  deleted_at: string;
  customer_name: string;
  customer_phone: string;
  payment_status?: string;
  dp_amount?: number;
  total_price: number;
  items: Transaction[];
};

const displayMaterialName = (name: string | undefined | null) => {
  if (!name) return "Material Terhapus";
  return name.replace(/\s*=\s*\((.*?)\)$/, "").trim();
};

const extractInvestor = (name: string | undefined | null) => {
  if (!name) return null;
  const match = name.match(/\s*=\s*\((.*?)\)$/);
  return match ? match[1] : null;
};

export default function TrashPage() {
  const [trashed, setTrashed] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeStore] = useState("karya_bahan");

  useEffect(() => {
    fetchAndCleanTrash("karya_bahan");
  }, []);

  async function fetchAndCleanTrash(store: string) {
    setLoading(true);
    
    // 1. Auto-delete items older than 10 days
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    await supabase
      .from("transactions")
      .delete()
      .eq("store", store)
      .not("deleted_at", "is", null)
      .lt("deleted_at", tenDaysAgo.toISOString());

    // 2. Fetch remaining trashed items
    const { data } = await supabase
      .from("transactions")
      .select("*, materials(name, code)")
      .eq("store", store)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (data) setTrashed(data as Transaction[]);
    setLoading(false);
  }

  function syncRestoreSheets(ids: string[]) {
    ids.forEach(id => {
      try {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore', payload: id, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // 1. Restore whole Nota
  async function handleRestoreNota(nota: TrashedNota) {
    const label = nota.customer_name ? `Nota ${nota.customer_name}` : 'Nota ini';
    if (!confirm(`Kembalikan ${label} (${nota.items.length} barang) ke riwayat aktif? (Stok akan disesuaikan kembali)`)) return;

    setProcessing(true);
    const ids = nota.items.map(t => t.id);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .in("id", ids);

    if (error) {
      alert("Error restore nota: " + error.message);
    } else {
      syncRestoreSheets(ids);
      await fetchAndCleanTrash(activeStore);
    }
    setProcessing(false);
  }

  // 2. Hard delete whole Nota
  async function handleHardDeleteNota(nota: TrashedNota) {
    const label = nota.customer_name ? `Nota ${nota.customer_name}` : 'Nota ini';
    if (!confirm(`PERINGATAN: ${label} (${nota.items.length} barang) akan dihapus secara PERMANEN dan tidak dapat dikembalikan. Lanjutkan?`)) return;

    setProcessing(true);
    const ids = nota.items.map(t => t.id);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", ids);

    if (error) {
      alert("Error hapus nota permanen: " + error.message);
    } else {
      await fetchAndCleanTrash(activeStore);
    }
    setProcessing(false);
  }

  // 3. Restore all items in a date
  async function handleRestoreDate(dateObj: Date, items: Transaction[]) {
    const dateFormatted = format(dateObj, "dd MMM yyyy");
    if (!confirm(`Kembalikan SEMUA nota tanggal ${dateFormatted} (${items.length} barang) ke riwayat aktif? (Stok akan disesuaikan kembali)`)) return;

    setProcessing(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .in("id", ids);

    if (error) {
      alert("Error restore tanggal: " + error.message);
    } else {
      syncRestoreSheets(ids);
      await fetchAndCleanTrash(activeStore);
    }
    setProcessing(false);
  }

  // 4. Hard delete all items in a date
  async function handleHardDeleteDate(dateObj: Date, items: Transaction[]) {
    const dateFormatted = format(dateObj, "dd MMM yyyy");
    if (!confirm(`PERINGATAN: SEMUA transaksi tanggal ${dateFormatted} (${items.length} barang) akan dihapus PERMANEN dan tidak dapat dikembalikan. Lanjutkan?`)) return;

    setProcessing(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", ids);

    if (error) {
      alert("Error hapus permanen tanggal: " + error.message);
    } else {
      await fetchAndCleanTrash(activeStore);
    }
    setProcessing(false);
  }

  // 5. Restore ALL items in trash
  async function handleRestoreAll() {
    if (!confirm(`Kembalikan SEMUA transaksi di tong sampah (${trashed.length} barang) ke riwayat aktif? (Stok akan disesuaikan kembali)`)) return;

    setProcessing(true);
    const ids = trashed.map(t => t.id);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .eq("store", activeStore)
      .not("deleted_at", "is", null);

    if (error) {
      alert("Error restore semua: " + error.message);
    } else {
      syncRestoreSheets(ids);
      await fetchAndCleanTrash(activeStore);
    }
    setProcessing(false);
  }

  // 6. Hard delete ALL items in trash
  async function handleEmptyTrash() {
    if (!confirm("PERINGATAN: SEMUA transaksi di tong sampah akan dihapus secara PERMANEN dan tidak dapat dikembalikan. Lanjutkan?")) return;

    setProcessing(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("store", activeStore)
      .not("deleted_at", "is", null);

    if (error) {
      alert("Error hapus semua: " + error.message);
    } else {
      await fetchAndCleanTrash(activeStore);
    }
    setProcessing(false);
  }

  // Group by Date -> then by Nota
  const dateGroups = useMemo(() => {
    const groups: Record<string, {
      dateKey: string;
      dateObj: Date;
      daysLeft: number;
      notasMap: Record<string, TrashedNota>;
      allItems: Transaction[];
    }> = {};

    trashed.forEach((t) => {
      const dDate = t.deleted_at ? new Date(t.deleted_at) : new Date();
      const dateKey = format(dDate, "yyyy-MM-dd");
      const daysLeft = Math.max(0, 10 - differenceInDays(new Date(), dDate));

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          dateObj: dDate,
          daysLeft,
          notasMap: {},
          allItems: [],
        };
      }

      groups[dateKey].allItems.push(t);

      // Group into nota by created_at + type + customer_name
      const notaKey = `${t.created_at || 'unknown'}_${t.type}_${t.customer_name || '-'}`;
      if (!groups[dateKey].notasMap[notaKey]) {
        groups[dateKey].notasMap[notaKey] = {
          key: notaKey,
          type: t.type,
          created_at: t.created_at,
          deleted_at: t.deleted_at || new Date().toISOString(),
          customer_name: t.customer_name && t.customer_name !== '-' ? t.customer_name : '',
          customer_phone: t.customer_phone && t.customer_phone !== '-' ? t.customer_phone : '',
          payment_status: t.payment_status,
          dp_amount: Number(t.dp_amount) || 0,
          total_price: 0,
          items: [],
        };
      }

      groups[dateKey].notasMap[notaKey].items.push(t);
      groups[dateKey].notasMap[notaKey].total_price += Number(t.total_price || 0);
    });

    return Object.values(groups)
      .map((g) => {
        const notas = Object.values(g.notasMap).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const totalAmount = g.allItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
        return {
          dateKey: g.dateKey,
          dateObj: g.dateObj,
          daysLeft: g.daysLeft,
          notas,
          allItems: g.allItems,
          totalAmount,
        };
      })
      .sort((a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime());
  }, [trashed]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-red-600 pb-4">
        <div className="flex items-center gap-3 text-red-600">
          <Trash2 className="w-8 h-8 flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tighter">Tong Sampah</h1>
            <p className="text-xs text-gray-600 mt-0.5">
              Dikelompokkan per nota dan per tanggal. Otomatis hilang permanen setelah 10 hari.
            </p>
          </div>
        </div>
        {trashed.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleRestoreAll}
              disabled={processing}
              className="bg-emerald-600 text-white px-4 py-2 text-sm font-bold uppercase hover:bg-emerald-700 transition-swiss active:scale-95 inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className="w-4 h-4" /> Restore Semua
            </button>
            <button 
              onClick={handleEmptyTrash}
              disabled={processing}
              className="bg-red-600 text-white px-4 py-2 text-sm font-bold uppercase hover:bg-red-800 transition-swiss active:scale-95 inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Hapus Semua Permanen
            </button>
          </div>
        )}
      </div>

      {/* Alert Banner */}
      <div className="bg-red-50 border border-red-200 p-4 flex gap-3 text-red-800 text-sm">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>PENTING:</strong> Riwayat transaksi yang ada di sini adalah transaksi yang sudah &quot;dibatalkan&quot;. 
          Stok material sudah dikembalikan otomatis saat dimasukkan ke tong sampah. 
          Jika di-<strong>Restore</strong>, stok material akan dikurangi kembali sesuai transaksi.
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="border border-black bg-white p-12 text-center text-gray-500 font-bold uppercase animate-pulse">
          Membuka Tong Sampah...
        </div>
      ) : dateGroups.length === 0 ? (
        <div className="border border-black bg-white p-12 text-center text-gray-400 italic">
          Tong sampah kosong. Tidak ada riwayat transaksi yang dibatalkan.
        </div>
      ) : (
        <div className="space-y-10">
          {dateGroups.map((group) => (
            <div key={group.dateKey} className="space-y-4">
              {/* Date Header Divider */}
              <div className="bg-neutral-900 text-white p-3 md:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-2 border-black shadow-sm">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-red-400" />
                    <span className="text-lg font-black uppercase tracking-tight">
                      {format(group.dateObj, "dd MMMM yyyy")}
                    </span>
                  </div>
                  <span className="bg-white/20 text-white px-2.5 py-0.5 text-xs font-bold font-mono rounded">
                    {group.notas.length} Nota ({group.allItems.length} Barang)
                  </span>
                  <span className="bg-red-500/30 text-red-200 border border-red-500/50 px-2 py-0.5 text-xs font-mono">
                    Hilang permanen dlm {group.daysLeft} hari
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleRestoreDate(group.dateObj, group.allItems)}
                    disabled={processing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold uppercase transition-colors inline-flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Restore ({format(group.dateObj, "dd MMM")})
                  </button>
                  <button
                    onClick={() => handleHardDeleteDate(group.dateObj, group.allItems)}
                    disabled={processing}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold uppercase transition-colors inline-flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Permanen ({format(group.dateObj, "dd MMM")})
                  </button>
                </div>
              </div>

              {/* Notas within this Date */}
              <div className="space-y-4">
                {group.notas.map((nota, notaIdx) => {
                  return (
                    <div key={nota.key} className="border-2 border-black bg-white overflow-hidden shadow-sm">
                      {/* Nota Header */}
                      <div className="bg-gray-100 border-b border-black p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span className="bg-black text-white px-2 py-0.5 font-black text-xs">
                            {nota.type === 'IN' ? 'RESTOCK' : `NOTA #${group.notas.length - notaIdx}`}
                          </span>
                          <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            {format(new Date(nota.created_at || nota.deleted_at), "HH:mm")}
                          </span>
                          {nota.customer_name && (
                            <span className="bg-blue-600 text-white px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {nota.customer_name} {nota.customer_phone ? `(${nota.customer_phone})` : ''}
                            </span>
                          )}
                          {nota.payment_status === 'DP' && (
                            <span className="bg-yellow-500 text-black px-2 py-0.5 text-xs font-bold rounded border border-black">
                              DP (Sisa Rp {Math.max(0, nota.total_price - (nota.dp_amount || 0)).toLocaleString("id-ID")})
                            </span>
                          )}
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {nota.items.length} barang
                          </span>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                          <div className="text-green-700 font-bold font-mono text-sm">
                            Total: Rp {nota.total_price.toLocaleString("id-ID")}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRestoreNota(nota)}
                              disabled={processing}
                              className="bg-black hover:bg-gray-800 text-white px-3 py-1.5 text-xs font-bold uppercase transition-colors inline-flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              <RefreshCcw className="w-3 h-3" /> Restore Nota
                            </button>
                            <button
                              onClick={() => handleHardDeleteNota(nota)}
                              disabled={processing}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold uppercase transition-colors inline-flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus Permanen
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200 font-mono">
                              <th className="py-2 px-3 text-center w-12">No</th>
                              <th className="py-2 px-3">Nama Barang</th>
                              <th className="py-2 px-3 text-center w-28">Jumlah</th>
                              <th className="py-2 px-3 text-right w-36">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {nota.items.map((item, itemIdx) => {
                              const investor = extractInvestor(item.materials?.name);
                              return (
                                <tr key={item.id} className={`${itemIdx !== nota.items.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-red-50/40 transition-colors`}>
                                  <td className="py-2 px-3 text-center text-gray-500 font-mono">{itemIdx + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-gray-800">
                                    {item.materials?.code && (
                                      <span className="text-xs font-mono bg-gray-200 px-1 py-0.5 rounded mr-2 border border-gray-400">
                                        [{item.materials.code}]
                                      </span>
                                    )}
                                    {displayMaterialName(item.materials?.name)}
                                    {investor && (
                                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 font-normal">
                                        {investor}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-medium">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                      {item.quantity} unit
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right text-gray-900 font-bold font-mono">
                                    Rp {item.total_price.toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
