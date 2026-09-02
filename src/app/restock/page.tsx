"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Package, PlusCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
  code?: string;
};

type Transaction = {
  id: string;
  material_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  cost_price: number;
  total_price: number;
  created_at: string;
  deleted_at: string | null;
  materials?: {
    name: string;
  };
};

export default function RestockPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [recentRestocks, setRecentRestocks] = useState<Transaction[]>([]);
  
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyMode, setBuyMode] = useState<'ecer' | 'grosir'>('ecer');
  const [costPrice, setCostPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionDate, setTransactionDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const activeStore = "karya_bahan";

  useEffect(() => {
    fetchMaterials();
    fetchRecentRestocks();

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setTransactionDate(now.toISOString().slice(0, 16));

    const sub = supabase
      .channel("restock:transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchRecentRestocks();
      })
      .subscribe();

    const matSub = supabase
      .channel("restock:materials")
      .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, () => {
        fetchMaterials();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(matSub);
    };
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  async function fetchMaterials() {
    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("store", activeStore)
      .order("name");
    if (data) setMaterials(data);
  }

  async function fetchRecentRestocks() {
    const { data } = await supabase
      .from("transactions")
      .select("*, materials(name)")
      .eq("store", activeStore)
      .eq("type", "IN")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentRestocks(data as Transaction[]);
  }

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
  const totalPrice = (costPrice !== "" && quantity !== "")
    ? Number(costPrice) * Number(quantity)
    : 0;

  const selectMaterial = (m: Material) => {
    setSelectedMaterialId(m.id);
    setSearchQuery(m.code ? `[${m.code}] ${m.name}` : m.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown') setIsDropdownOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredMaterials.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredMaterials.length) {
        selectMaterial(filteredMaterials[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

        async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMaterialId || quantity === "" || Number(quantity) <= 0 || costPrice === "" || Number(costPrice) <= 0) return;

    let multiplier = 1;
    if (selectedMaterial && buyMode === 'grosir') {
      const match = selectedMaterial.name.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^\]]+?)\]$/);
      if (match) multiplier = Number(match[2]);
    }

    const calculatedQty = Number(quantity) * multiplier;
    const calculatedCost = multiplier > 1 ? Math.round(Number(costPrice) / multiplier) : Number(costPrice);
    const calculatedTotal = Number(quantity) * Number(costPrice);

    setLoading(true);

    const insertData: any = {
      material_id: selectedMaterialId,
      type: 'IN',
      quantity: calculatedQty,
      cost_price: calculatedCost,
      total_price: calculatedTotal,
      store: activeStore
    };

    if (transactionDate) {
      insertData.created_at = new Date(transactionDate).toISOString();
    }

    const { error } = await supabase.from("transactions").insert([insertData]);

    setLoading(false);
    if (!error) {
      showToast("Stok berhasil ditambahkan", "success");
      setSelectedMaterialId("");
      setSearchQuery("");
      setQuantity("");
      setCostPrice("");
    } else {
      console.error(error);
      showToast("Gagal menambah stok: " + error.message, "error");
    }
  }

  async function softDeleteTransaction(id: string) {
    if (!confirm("Buang transaksi restock ini ke tong sampah?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    setLoading(false);
    if (error) {
      showToast("Gagal menghapus: " + error.message, "error");
    } else {
      showToast("Transaksi dihapus", "success");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold uppercase flex items-center gap-3">
          <Package className="w-8 h-8" />
          Restock / Kulakan
        </h1>
        <p className="text-gray-500 mt-2">Catat pembelian stok dari supplier.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="border border-black p-6 bg-white">
            <h2 className="text-lg font-bold uppercase mb-6 flex items-center gap-2 border-b border-gray-200 pb-3">
              <PlusCircle className="w-5 h-5" />
              Tambah Stok
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide">Tanggal</label>
                <input
                  type="datetime-local"
                  className="w-full border border-black p-3 bg-transparent focus-ring transition-swiss"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>

              {/* Material Search */}
              <div className="relative">
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide">Material / Kode Barang</label>
                <div className={`w-full border bg-white transition-swiss ${isDropdownOpen ? 'border-black ring-1 ring-black' : 'border-black'}`}>
                  <input
                    type="text"
                    className="w-full p-3 bg-transparent focus:outline-none"
                    placeholder="Ketik nama atau kode..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHighlightedIndex(-1);
                      setIsDropdownOpen(true);
                      if (selectedMaterialId) setSelectedMaterialId("");
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  />
                </div>

                {isDropdownOpen && (
                  <div ref={dropdownRef} className="absolute z-20 w-full mt-1 bg-white border border-black shadow-xl max-h-60 overflow-y-auto animate-fade-in">
                    {filteredMaterials.length === 0 ? (
                      <div className="p-3 text-gray-500 text-sm">Tidak ditemukan...</div>
                    ) : (
                      filteredMaterials.map((m, index) => (
                        <div
                          key={m.id}
                          className={`p-3 cursor-pointer border-b border-gray-100 transition-colors flex justify-between items-center hover:bg-gray-100 ${selectedMaterialId === m.id ? 'bg-gray-200 font-bold' : ''} ${highlightedIndex === index ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectMaterial(m);
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <div>
                            {m.code && <span className="text-xs font-mono bg-white px-1 py-0.5 rounded mr-2 border border-black">{m.code}</span>}
                            <span>{m.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">Stok: {m.current_stock}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {selectedMaterial && (
                  <div className="mt-2 text-xs text-gray-600 font-mono bg-gray-100 p-2 border border-gray-300">
                    <div>Harga Jual: Rp {selectedMaterial.price.toLocaleString("id-ID")}</div>
                    <div>Stok Saat Ini: {selectedMaterial.current_stock}</div>
                  </div>
                )}
              </div>

                            {/* Quantity */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide">Quantity</label>
                {(() => {
                  let isPack = false;
                  let packName = '';
                  let baseUnit = 'Pcs';
                  if (selectedMaterial) {
                    const match = selectedMaterial.name.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^\]]+?)\]$/);
                    if (match) {
                      isPack = true;
                      packName = match[1].trim();
                      baseUnit = match[3].trim();
                    } else {
                      const baseMatch = selectedMaterial.name.match(/-\s*\[([^=\]]+?)\]$/);
                      if (baseMatch) baseUnit = baseMatch[1].trim();
                    }
                  }

                  return (
                    <>
                      <div className="flex border border-black mb-3">
                        <button type="button" onClick={() => setBuyMode('ecer')} className={`flex-1 p-2 text-xs font-bold uppercase transition-colors ${buyMode === 'ecer' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          Eceran {selectedMaterial ? `(${baseUnit})` : ''}
                        </button>
                        <button type="button" onClick={() => setBuyMode('grosir')} disabled={selectedMaterial && !isPack} className={`flex-1 p-2 text-xs font-bold uppercase border-l border-black transition-colors ${buyMode === 'grosir' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`} title={selectedMaterial && !isPack ? "Barang ini tidak memiliki settingan Grosir" : ""}>
                          Grosir {isPack ? `(${packName})` : '(Dus/Pack)'}
                        </button>
                      </div>
                      <input
                        ref={qtyInputRef}
                        type="number"
                        min="1"
                        className="w-full border border-black p-3 bg-transparent focus-ring transition-swiss"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value.replace(/^0+(?=\d)/, ''))}
                        placeholder={isPack && buyMode === 'grosir' ? `Berapa ${packName}?` : `Jumlah ${baseUnit}`}
                        required
                      />
                    </>
                  );
                })()}
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wide text-red-600">
                  Harga Modal / Pcs (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-black p-3 bg-transparent focus-ring transition-swiss"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
                  placeholder="Contoh: 50000"
                  required
                />
              </div>

              {/* Total */}
              <div className="pt-4 border-t border-gray-300">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold uppercase">Total Modal</span>
                  <span className="font-mono font-bold text-red-600">
                    Rp <AnimatedNumber value={totalPrice} />
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedMaterialId || quantity === "" || Number(quantity) <= 0 || costPrice === "" || Number(costPrice) <= 0}
                className="w-full bg-black text-white p-4 font-bold uppercase tracking-wider hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-swiss hover-elevate active-press flex justify-center items-center gap-2"
              >
                {loading ? "PROCESSING..." : (
                  <>
                    <PlusCircle className="w-5 h-5" />
                    TAMBAH STOK
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Restocks */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
            <Package className="w-6 h-6" />
            RIWAYAT RESTOCK TERBARU
          </h2>
          <div className="border border-black bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-black text-white uppercase tracking-wide text-xs">
                    <th className="p-3 font-bold">Tanggal</th>
                    <th className="p-3 font-bold">Material</th>
                    <th className="p-3 font-bold text-right">Qty</th>
                    <th className="p-3 font-bold text-right">H. Modal/Pcs</th>
                    <th className="p-3 font-bold text-right">Total (Rp)</th>
                    <th className="p-3 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRestocks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                        Belum ada restock tercatat.
                      </td>
                    </tr>
                  ) : (
                    recentRestocks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 border-b border-gray-200 transition-swiss">
                        <td className="p-3">
                          {format((t.created_at ? new Date(t.created_at) : new Date(0)), "dd MMM yyyy, HH:mm")}
                        </td>
                        <td className="p-3 font-medium">
                          {t.materials?.name || "Unknown"}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {t.quantity}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {(t.cost_price || 0).toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-red-600">
                          - {t.total_price.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => softDeleteTransaction(t.id)}
                            className="text-gray-400 hover:text-red-600 transition-swiss active-press"
                            title="Buang ke Tong Sampah"
                          >
                            <Trash2 className="w-5 h-5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}







