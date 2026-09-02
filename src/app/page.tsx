"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { PlusCircle, ShoppingCart, ArrowDownRight, ArrowUpRight, Wallet, Trash2, Printer, X, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { subDays } from "date-fns";
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

type CartItem = { custom_price?: number;
  material: Material;
  quantity: number;
  subtotal: number;
};

export default function POSDashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeStore] = useState<string>("karya_bahan");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { showToast } = useToast();

  const [receiptData, setReceiptData] = useState<{
    invoiceNo: string;
    date: Date;
    items: CartItem[];
    total: number;
  } | null>(null);

  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData("karya_bahan");

    const materialSubscription = supabase
      .channel("public:materials")
      .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, () => {
        fetchMaterials("karya_bahan");
      })
      .subscribe();

    const transactionSubscription = supabase
      .channel("public:transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions("karya_bahan");
      })
      .subscribe();



    return () => {
      supabase.removeChannel(materialSubscription);
      supabase.removeChannel(transactionSubscription);
    };
  }, []);



  async function fetchData(store: string) {
    await fetchMaterials(store);
    await fetchTransactions(store);
  }

  async function fetchMaterials(store: string) {
    const { data } = await supabase.from("materials").select("*").eq("store", store).order("name");
    if (data) setMaterials(data);
  }

  async function fetchTransactions(store: string) {
    const { data: recent } = await supabase
      .from("transactions")
      .select("*, materials(name)")
      .eq("store", store)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (recent) setTransactions(recent);

    const { data: all } = await supabase
      .from("transactions")
      .select("type, total_price, created_at")
      .eq("store", store)
      .is("deleted_at", null);
    if (all) setAllTransactions(all as Transaction[]);
  }

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);
  
  // Calculate last 7 days sales
  const last7DaysSales = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const daySales = allTransactions.filter(t => t.type === 'OUT' && (t.created_at ? format((t.created_at ? new Date(t.created_at) : new Date(0)), 'yyyy-MM-dd') : '') === dateStr);
      const total = daySales.reduce((sum, t) => sum + Number(t.total_price), 0);
      data.push({ date: format(d, 'dd MMM'), total });
    }
    return data;
  }, [allTransactions]);

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  function addToCart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMaterial || !quantity || Number(quantity) <= 0) return;

    const qtyNum = Number(quantity);
    if (qtyNum > selectedMaterial.current_stock) {
      showToast(`Stok tidak cukup! (Sisa: ${selectedMaterial.current_stock})`, "error");
      return;
    }

    const subtotal = selectedMaterial.price * qtyNum;

    setCart(prev => {
      const existing = prev.find(item => item.material.id === selectedMaterial.id);
      if (existing) {
        return prev.map(item => 
          item.material.id === selectedMaterial.id ? { ...item, quantity: item.quantity + qtyNum, subtotal: (item.custom_price || item.material.price) * (item.quantity + qtyNum) }
            : item
        );
      }
      return [...prev, { material: selectedMaterial, quantity: qtyNum, subtotal, custom_price: selectedMaterial.price }];
    });

    setSelectedMaterialId("");
    setSearchQuery("");
    setQuantity("");
    if (quantityInputRef.current) quantityInputRef.current.blur();
  }

  function updateItemPrice(index: number, newPrice: number) { setCart(prev => prev.map((item, i) => i === index ? { ...item, custom_price: newPrice, subtotal: newPrice * item.quantity } : item)); }

  function removeFromCart(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);

    const now = new Date();
    const invoiceNo = `KB-${now.getTime()}`;

    const insertData = cart.map(item => ({
      material_id: item.material.id,
      type: 'OUT',
      quantity: item.quantity,
      cost_price: item.material.cost_price,
      total_price: item.subtotal,
      store: activeStore,
      created_at: now.toISOString()
    }));

    const { error } = await supabase.from("transactions").insert(insertData);

    setLoading(false);
    if (!error) {
      showToast("Transaksi berhasil disimpan", "success");
      setReceiptData({
        invoiceNo,
        date: now,
        items: [...cart],
        total: cartTotal
      });
      setCart([]);
    } else {
      console.error(error);
      showToast("Gagal menyimpan transaksi", "error");
    }
  }

  async function softDeleteTransaction(id: string) {
    if (!confirm("Buang transaksi ini ke tong sampah?")) return;
    setLoading(true);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
      
    setLoading(false);
    if (error) {
      console.error(error);
      showToast("Gagal menghapus transaksi", "error");
    } else {
      showToast("Transaksi berhasil dihapus", "success");
    }
  }

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const itemElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (itemElement) {
        itemElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const selectMaterial = (m: Material) => {
    if (m.current_stock <= 0) return;
    setSelectedMaterialId(m.id);
    setSearchQuery(m.code ? `[${m.code}] ${m.name}` : m.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    
    // Auto focus quantity
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }, 50);
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-12 animate-fade-in print:p-0 print:m-0 print:max-w-none">
      
      {/* Receipt Modal (Only visible when receiptData exists, and hides other content when printing) */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:static print:bg-white print:z-auto print:flex print:items-start print:justify-start">
                    <div className="bg-white p-8 max-w-3xl w-full shadow-2xl relative print:shadow-none print:p-0 print:max-w-full print:w-full">
            <div className="absolute top-2 right-2 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="p-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors" title="Cetak">
                <Printer className="w-5 h-5" />
              </button>
              <button onClick={() => setReceiptData(null)} className="p-2 bg-gray-200 hover:bg-red-500 hover:text-white rounded transition-colors" title="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Receipt Content NCR 2-ply Style */}
            <div className="text-black font-sans print:font-sans w-full">
              <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">KARYA BAHAN</h2>
                  <p className="text-sm font-bold uppercase text-gray-700 mt-1">Toko Material & Bangunan</p>
                  <p className="text-xs italic mt-1 font-semibold uppercase tracking-widest text-gray-500">Jaya Plafon</p>
                </div>
                <div className="text-right text-sm">
                  <div className="flex gap-4 justify-end"><span className="w-16 text-left">No</span>: <span className="font-bold">{receiptData.invoiceNo}</span></div>
                  <div className="flex gap-4 justify-end"><span className="w-16 text-left">Tanggal</span>: <span>{format(receiptData.date, "dd/MM/yyyy")}</span></div>
                  <div className="flex gap-4 justify-end"><span className="w-16 text-left">Waktu</span>: <span>{format(receiptData.date, "HH:mm")}</span></div>
                  <div className="flex gap-4 justify-end"><span className="w-16 text-left">Kasir</span>: <span>Admin</span></div>
                </div>
              </div>
              
              <table className="w-full text-left mb-6 border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100 print:bg-transparent">
                    <th className="border border-black p-2 w-12 text-center text-sm font-bold">NO</th>
                    <th className="border border-black p-2 text-sm font-bold">NAMA BARANG</th>
                    <th className="border border-black p-2 text-center w-20 text-sm font-bold">QTY</th>
                    <th className="border border-black p-2 text-right w-32 text-sm font-bold">HARGA (Rp)</th>
                    <th className="border border-black p-2 text-right w-40 text-sm font-bold">JUMLAH (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-black p-2 text-center">{idx + 1}</td>
                      <td className="border border-black p-2 font-medium">{item.material.code ? []  : ''}{item.material.name}</td>
                      <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                      <td className="border border-black p-2 text-right">{(item.custom_price ?? item.material.price).toLocaleString("id-ID")}</td>
                      <td className="border border-black p-2 text-right font-bold">{item.subtotal.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="border border-black p-2 text-right font-bold text-lg">TOTAL KESELURUHAN</td>
                    <td className="border border-black p-2 text-right font-bold text-lg bg-gray-50 print:bg-transparent">Rp {receiptData.total.toLocaleString("id-ID")}</td>
                  </tr>
                </tfoot>
              </table>
              
              <div className="flex justify-between items-end mt-12 px-8">
                <div className="text-center">
                  <p className="mb-16 text-sm">Tanda Terima,</p>
                  <p className="border-t border-black w-32"></p>
                </div>
                <div className="text-center">
                  <p className="mb-16 text-sm">Hormat Kami,</p>
                  <p className="border-t border-black w-32"></p>
                </div>
              </div>

              <div className="text-center text-xs mt-8 pt-4 border-t border-dashed border-gray-400 print:hidden text-gray-500">
                <p>Format Struk NCR 2-Ply (1/2 Folio / A5). Silakan setel ukuran kertas pada pengaturan printer (Ctrl+P).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content (Hidden during print) */}
      <div className="print:hidden space-y-12">
        {/* Sales Chart */}
        <div>
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
            <BarChart2 className="w-5 h-5" />
            Grafik Penjualan (7 Hari Terakhir)
          </h2>
          <div className="h-48 w-full border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl p-4 mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysSales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: any) => ["Rp " + Number(value).toLocaleString("id-ID"), "Penjualan"]} />
                <Bar dataKey="total" fill="#000000" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* POS Form - 1/3 Width */}
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
              <PlusCircle className="w-6 h-6" />
              TAMBAH BARANG
            </h2>
            
            <form onSubmit={addToCart} className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-bold mb-2 uppercase">Cari Barang</label>
                <div 
                  className={`w-full border bg-white flex items-center relative transition-swiss ${isDropdownOpen ? 'border-black ring-1 ring-black' : 'border-black'}`}
                >
                  <input
                    type="text"
                    className="w-full p-3 bg-transparent focus:outline-none"
                    placeholder="Ketik nama atau kode barang..."
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
                          className={`p-3 cursor-pointer border-b border-gray-100 transition-colors flex justify-between items-center ${m.current_stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'} ${selectedMaterialId === m.id ? 'bg-gray-200 font-bold' : ''} ${highlightedIndex === index ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
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
                          <div className="text-xs text-gray-500 font-mono">Stock: {m.current_stock}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 uppercase">Quantity</label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  min="1"
                  max={selectedMaterial?.current_stock || undefined}
                  className="w-full border border-black p-3 bg-transparent focus-ring transition-swiss"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/^0+(?=\d)/, ''))}
                  placeholder="Jumlah barang"
                  required
                />
                {selectedMaterial && (
                  <div className="mt-1 text-xs text-gray-500 font-mono">
                    Harga: Rp {selectedMaterial.price.toLocaleString("id-ID")} | Max Qty: {selectedMaterial.current_stock}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedMaterialId || quantity === "" || Number(quantity) <= 0}
                className="w-full border-2 border-black bg-white text-black p-4 font-bold uppercase tracking-wider hover:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 transition-swiss hover-elevate active-press flex justify-center items-center gap-2"
              >
                TAMBAH KE KERANJANG
              </button>
            </form>
          </div>

          {/* Cart Table - 2/3 Width */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              KERANJANG
            </h2>
            
            <div className="border border-black bg-white overflow-hidden flex flex-col min-h-[400px]">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-100 uppercase tracking-wide">
                      <th className="p-3 border-b-2 border-black font-bold w-12 text-center">No</th>
                      <th className="p-3 border-b-2 border-black font-bold">Barang</th>
                      <th className="p-3 border-b-2 border-black font-bold text-right">Qty</th>
                      <th className="p-3 border-b-2 border-black font-bold text-right">Harga/Pcs</th>
                      <th className="p-3 border-b-2 border-black font-bold text-right">Subtotal</th>
                      <th className="p-3 border-b-2 border-black font-bold text-center w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500 italic">Keranjang kosong. Tambahkan barang di sebelah kiri.</td>
                      </tr>
                    ) : (
                      cart.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 border-b border-gray-200">
                          <td className="p-3 text-center">{index + 1}</td>
                          <td className="p-3 font-medium">
                            {item.material.code && <span className="text-xs font-mono bg-white px-1 py-0.5 rounded mr-2 border border-black">{item.material.code}</span>}
                            {item.material.name}
                          </td>
                          <td className="p-3 text-right font-mono">{item.quantity}</td>
                          <td className="p-3 text-right font-mono">
                            <div className="flex items-center justify-end gap-1">
                              <span>Rp</span>
                              <input
                                type="number"
                                className="w-24 bg-white border border-gray-300 px-2 py-1 text-right focus:outline-none focus:border-black rounded-none"
                                value={item.custom_price ?? item.material.price}
                                onChange={(e) => updateItemPrice(index, Number(e.target.value))}
                              />
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">Rp {item.subtotal.toLocaleString("id-ID")}</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => removeFromCart(index)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-gray-100 p-4 border-t-2 border-black">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold uppercase tracking-wider">Grand Total</span>
                  <span className="text-3xl font-mono font-bold text-green-700">
                    Rp <AnimatedNumber value={cartTotal} />
                  </span>
                </div>
                
                <button
                  onClick={handleCheckout}
                  disabled={loading || cart.length === 0}
                  className="w-full bg-black text-white p-4 font-bold text-lg uppercase tracking-wider hover:bg-gray-800 disabled:bg-gray-400 transition-swiss hover-elevate active-press flex justify-center items-center gap-2"
                >
                  {loading ? "PROCESSING..." : "BAYAR / CHECKOUT"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">
            RECENT TRANSACTIONS
          </h2>
          <div className="overflow-x-auto border border-black bg-white">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-100 uppercase tracking-wide">
                  <th className="p-3 border-b-2 border-black font-bold">Date</th>
                  <th className="p-3 border-b-2 border-black font-bold">Material</th>
                  <th className="p-3 border-b-2 border-black font-bold text-right">Qty</th>
                  <th className="p-3 border-b-2 border-black font-bold text-right">Total (Rp)</th>
                  <th className="p-3 border-b-2 border-black font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 italic">No active transactions found.</td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b border-gray-200">
                        {format((t.created_at ? new Date(t.created_at) : new Date(0)), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="p-3 border-b border-gray-200 font-medium">
                        {t.materials?.name || "Unknown"}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-right font-mono">
                        {t.quantity}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-right font-mono font-bold text-green-600">
                        + {t.total_price.toLocaleString("id-ID")}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-center">
                        <button 
                          onClick={() => softDeleteTransaction(t.id)}
                          className="text-xs border border-red-500 text-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-swiss active-press"
                        >
                          Hapus
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
  );
}











