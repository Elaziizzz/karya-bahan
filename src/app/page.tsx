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
  payment_status?: string;
  dp_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  materials?: { name: string; code?: string; };
};

type CartItem = {
  material: Material;
  quantity: number;
  subtotal: number;
  display_quantity: number;
  display_unit: string;
  display_price: number;
  pack_multiplier: number;
};


// Helper to hide investor from Kasir display
const displayMaterialName = (name: string | undefined | null) => {
  if (!name) return "";
  return name.replace(/\s*=\s*\((.*?)\)$/, "");
};

export default function POSDashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"LUNAS" | "DP">("LUNAS");
  const [dpAmount, setDpAmount] = useState("");

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editQty, setEditQty] = useState("");
  
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyMode, setBuyMode] = useState<'ecer' | 'grosir'>('ecer');
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
    customerName: string;
    customerPhone: string;
    paymentStatus: string;
    dpAmount: number;
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
      .select("*, materials(name, code)")
      .eq("store", store)
      .eq("type", "OUT")
      .is("deleted_at", null)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order("created_at", { ascending: false });
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

  
  async function editFullNota(items: Transaction[]) {
    if (!confirm("Edit Nota ini? Seluruh barang di nota ini akan dipindah kembali ke Keranjang, dan nota asli akan dihapus dari riwayat (Stock akan dikembalikan).")) return;
    
    setLoading(true);
    
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    
    if (error) {
      alert("Gagal mengedit nota: " + error.message);
      setLoading(false);
      return;
    }

    const newCart: CartItem[] = [];
    for (const t of items) {
      const mat = materials.find(m => m.id === t.material_id);
      if (!mat) continue;

      let display_quantity = t.quantity;
      let display_unit = 'Pcs';
      let pack_multiplier = 1;
      
      const packMatch = mat.name.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^@\]]+?)(?:\s*@\s*(\d+))?\](?:\s*=\s*\((.*?)\))?$/);
      if (packMatch) {
         const packName = packMatch[1].trim();
         const packMult = Number(packMatch[2]);
         if (t.quantity % packMult === 0 && t.quantity >= packMult) {
           display_quantity = t.quantity / packMult;
           display_unit = packName;
           pack_multiplier = packMult;
         } else {
           display_unit = packMatch[3].trim();
         }
      } else {
         const baseMatch = mat.name.match(/-\s*\[([^=\]]+?)\](?:\s*=\s*\((.*?)\))?$/);
         if (baseMatch) {
           display_unit = baseMatch[1].trim();
         }
      }

      // Calculate the display_price derived from subtotal and display_quantity
      let display_price = Math.round(t.total_price / display_quantity);

      newCart.push({
        material: mat,
        quantity: t.quantity,
        display_quantity,
        display_unit,
        display_price,
        pack_multiplier,
        subtotal: t.total_price
      });
    }

    setCart(newCart);
    
    ids.forEach(id => {
      fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
      }).catch(console.error);
    });

    setLoading(false);
    fetchData(activeStore);
  }

  async function lunasiNota(items: Transaction[]) {
    const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
    const dp = Number(items[0].dp_amount) || 0;
    const sisa = totalNota - dp;
    if (!confirm(`Konfirmasi pelunasan sisa tagihan sebesar Rp ${sisa.toLocaleString("id-ID")} untuk nota ini?`)) return;
    
    setLoading(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ payment_status: 'LUNAS', dp_amount: totalNota }).in("id", ids);
    
    if (error) {
      alert("Gagal memproses pelunasan: " + error.message);
    } else {
      showToast("Pelunasan berhasil diproses!", "success");
      const invoiceNo = `KB-${new Date(items[0].created_at || 0).getTime()}`;
      try {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lunas', payload: { invoiceNo, total: totalNota }, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      } catch (e) { console.error(e); }
    }
    setLoading(false);
    fetchData(activeStore);
  }

  async function deleteFullNota(items: Transaction[]) {
    if (!confirm("Hapus Nota ini secara permanen? Stok akan dikembalikan seperti semula.")) return;
    
    setLoading(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    
    if (error) {
      alert("Gagal menghapus nota: " + error.message);
    } else {
      showToast("Nota berhasil dihapus!", "success");
      ids.forEach(id => {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      });
    }
    setLoading(false);
    fetchData(activeStore);
  }

  // Inject point
  function addToCart(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedMaterial || !quantity || Number(quantity) <= 0) return;

    let multiplier = 1;
    let baseUnit = 'Pcs';
    let displayUnit = 'Pcs';
    let displayPrice = selectedMaterial.price;
    let isGrosirMode = buyMode === 'grosir';

    const baseMatch = selectedMaterial.name.match(/-\s*\[([^=\]]+?)\](?:\s*=\s*\((.*?)\))?$/);
    if (baseMatch) {
      baseUnit = baseMatch[1].trim();
      displayUnit = baseUnit;
    }

    if (isGrosirMode) {
      const match = selectedMaterial.name.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^@\]]+?)(?:\s*@\s*(\d+))?\](?:\s*=\s*\((.*?)\))?$/);
      if (match) {
        displayUnit = match[1].trim();
        multiplier = Number(match[2]);
        baseUnit = match[3].trim();
        if (match[4]) {
          displayPrice = Number(match[4]);
        } else {
          displayPrice = selectedMaterial.price * multiplier;
        }
      } else {
        isGrosirMode = false;
      }
    } else {
      const packMatch = selectedMaterial.name.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^@\]]+?)(?:\s*@\s*(\d+))?\](?:\s*=\s*\((.*?)\))?$/);
      if (packMatch) {
        baseUnit = packMatch[3].trim();
        displayUnit = baseUnit;
      }
    }

    const qtyNum = Number(quantity); // user input (e.g. 3)
    const baseQtyNum = qtyNum * multiplier; // (e.g. 45)

    if (baseQtyNum > selectedMaterial.current_stock) {
      showToast("Stok tidak cukup! (Sisa: " + selectedMaterial.current_stock + ")", "error");
      return;
    }

    const subtotal = displayPrice * qtyNum;
    
    setCart(prev => {
      const existing = prev.findIndex(item => item.material.id === selectedMaterial.id && item.display_price === displayPrice && item.display_unit === displayUnit);
      if (existing >= 0) {
        const newCart = [...prev];
        newCart[existing].display_quantity += qtyNum;
        newCart[existing].quantity += baseQtyNum;
        newCart[existing].subtotal += subtotal;
        return newCart;
      }
      return [...prev, { 
        material: selectedMaterial, 
        quantity: baseQtyNum, 
        subtotal, 
        display_quantity: qtyNum,
        display_unit: displayUnit,
        display_price: displayPrice,
        pack_multiplier: multiplier
      }];
    });

    setSelectedMaterialId("");
    setSearchQuery("");
    setQuantity("");
    setBuyMode('ecer');
    if (quantityInputRef.current) quantityInputRef.current.blur();
  }

  function updateItemPrice(index: number, newPriceStr: string) {
    const cleanStr = newPriceStr.replace(/^0+(?=\d)/, '');
    const parsed = cleanStr === "" ? 0 : parseInt(cleanStr, 10);
    const finalPrice = isNaN(parsed) ? 0 : parsed;
    setCart(prev => prev.map((item, i) => i === index ? { ...item, display_price: finalPrice, subtotal: finalPrice * item.display_quantity } : item)); 
  }

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

    const { data: insertedData, error } = await supabase.from("transactions").insert(insertData).select('id');

    setLoading(false);
    if (!error) {
      // Sync to Google Sheets
      if (insertedData) {
        try {
          const year = now.getFullYear().toString();
          // Group everything into ONE Nota row for Spreadsheet
          const notaItemsText = cart.map(item => `${item.display_quantity} ${item.display_unit} ${displayMaterialName(item.material.name).replace(/-\s*\[.*?\]$/, '').trim()}`).join(', ');
          const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
          
          const sheetPayload = [[
            invoiceNo, // Kita pakai invoiceNo sebagai ID utamanya di Spreadsheet
            format(now, "yyyy-MM-dd"),
            format(now, "HH:mm"),
            activeStore === 'karya_bahan' ? 'Karya Bahan' : 'Bysca',
            'JUAL (OUT) - NOTA',
            notaItemsText,
            '1 Nota',
            grandTotal,
            '? VALID'
          ]];
          fetch('/api/sheets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkout', payload: sheetPayload, year })
          }).then(res => res.json()).then(data => {
            console.log('Sheets Sync Checkout:', data);
            if (data.error) alert('Gagal Sinkronisasi Google Sheets: ' + data.error);
          }).catch(console.error);
        } catch (e) {
          console.error(e);
        }
      }

      showToast("Transaksi berhasil disimpan", "success");
      setReceiptData({
          invoiceNo,
          date: now,
          items: [...cart],
          total: cartTotal,
          customerName: customerName || "-",
          customerPhone: customerPhone || "-",
          paymentStatus,
          dpAmount: paymentStatus === 'DP' ? (Number(dpAmount) || 0) : cartTotal
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
      // Sync to Google Sheets
      try {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      } catch (e) {
        console.error(e);
      }
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
    if (m.current_stock <= 0) { showToast("Stok barang ini kosong (0)! Silakan restok dulu.", "error"); return; }
    setSelectedMaterialId(m.id);
    setSearchQuery(m.code ? `[${m.code}] ${displayMaterialName(m.name)}` : displayMaterialName(m.name));
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setBuyMode('ecer');
    setQuantity("");
    
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
            <div className="text-black font-mono print:font-mono w-full text-[11px] leading-relaxed">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg tracking-widest">{activeStore === 'karya_bahan' ? 'KARYA BAHAN JAYA PLAVON' : 'BYSCA'}</h2>
                  <p className="mt-4">Alamat : {activeStore === 'karya_bahan' ? 'Jl.Raya Barat No.6 Kasturi Cikijing,Majalengka' : '-'}</p>
                  <p>Telepon: {activeStore === 'karya_bahan' ? '081323299754 / 085722328871' : '-'}</p>
                  <p>Sales  : Admin</p>
                    <div className="mt-2 border-t border-dashed border-black pt-2 w-48">
                      <p>Customer: <b>{receiptData.customerName || "-"}</b></p>
                      <p>No. Telp: {receiptData.customerPhone || "-"}</p>
                    </div>
                  </div>
                <div className="text-center">
                  <div className="mb-4">Hal : 1</div>
                  <h1 className="text-xl tracking-[0.5em] mb-4">FAKTUR</h1>
                </div>
                <div className="text-right">
                  <div className="mb-4 text-transparent">Hal : 1</div>
                  <div className="flex gap-2 justify-end"><span className="w-20 text-left">Tanggal</span>: <span>{format(receiptData.date, "dd-MMM-yyyy HH:mm")}</span></div>
                  <div className="flex gap-2 justify-end"><span className="w-20 text-left">No. Faktur</span>: <span>{receiptData.invoiceNo}</span></div>
                </div>
              </div>
              
              <table className="w-full text-left mb-4 border-collapse">
                <thead>
                  <tr className="border-t border-b border-black border-dashed">
                    <th className="py-2 font-normal w-10">NO.</th>
                    <th className="py-2 font-normal">NAMA BARANG</th>
                    <th className="py-2 font-normal text-right w-24">QTY</th>
                    <th className="py-2 font-normal text-right w-24">HARGA</th>
                                        <th className="py-2 font-normal text-right w-32">JUMLAH</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1 align-top">{idx + 1}</td>
                      <td className="py-1 align-top">
                        {item.material.code ? `[${item.material.code}] ` : ''}
                        {displayMaterialName(item.material.name).replace(/-\s*\[.*?\]$/, '').trim()}
                      </td>
                      <td className="py-1 text-right align-top">
                        {item.display_quantity} {item.display_unit.toUpperCase()}
                      </td>
                      <td className="py-1 text-right align-top">{item.display_price.toLocaleString("id-ID")}</td>
                                            <td className="py-1 text-right align-top">{item.subtotal.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="border-t border-black border-dashed pt-2 flex justify-between items-start">
                <div className="text-center ml-8">
                  <p className="mb-16">Tanda Terima</p>
                  <p>(...................)</p>
                </div>
                <div className="text-center">
                  <p className="mb-16">Hormat Kami</p>
                  <p>(...................)</p>
                </div>
                <div className="w-64">
                  <div className="flex justify-between py-1">
                    <span>Sub Total :</span>
                    <span>{receiptData.total.toLocaleString("id-ID")}</span>
                  </div>
                                    <div className="flex justify-between py-1 font-bold">
                    <span>Total     :</span>
                      <span>{receiptData.total.toLocaleString("id-ID")}</span>
                    </div>
                    {receiptData.paymentStatus === 'DP' && (
                      <div className="border-t border-black border-dashed mt-1 pt-1">
                        <div className="flex justify-between py-1 font-bold">
                          <span>Tunai / DP :</span>
                          <span>{receiptData.dpAmount.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-lg mt-1">
                          <span>SISA KURANG:</span>
                          <span>{(receiptData.total - receiptData.dpAmount).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                
                <div className="clear-both"></div>

              <div className="text-center text-[10px] mt-8 pt-4 border-t border-dashed border-gray-300 print:hidden text-gray-500">
                <p>Format Struk NCR 1/2 Folio. Setel ukuran kertas: 215mm x 140mm pada pengaturan printer (Ctrl+P).</p>
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
    setBuyMode('ecer');
    setQuantity("");
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
                            <span>{displayMaterialName(m.name)}</span>
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
                  {(() => {
                    let isPack = false;
                    let packName = '';
                    let baseUnit = 'Pcs';
                    if (selectedMaterial) {
                      const match = selectedMaterial.name.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^\]]+?)\](?:\s*=\s*\((.*?)\))?$/);
                      if (match) {
                        isPack = true;
                        packName = match[1].trim();
                        baseUnit = match[3].trim();
                      } else {
                        const baseMatch = selectedMaterial.name.match(/-\s*\[([^=\]]+?)\](?:\s*=\s*\((.*?)\))?$/);
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
                          ref={quantityInputRef}
                          type="number"
                          min="1"
                          max={buyMode === 'ecer' ? (selectedMaterial?.current_stock || undefined) : undefined}
                          className="w-full border border-black p-3 bg-transparent focus-ring transition-swiss"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value.replace(/^0+(?=\d)/, ''))}
                          placeholder={isPack && buyMode === 'grosir' ? `Berapa ${packName}?` : `Jumlah ${baseUnit}`}
                          required
                        />
                      </>
                    );
                  })()}
                  
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
                            {displayMaterialName(item.material.name).replace(/-\s*\[.*?\]$/, '').trim()}
                          </td>
                          <td className="p-3 text-right font-mono">
                              <div className="text-lg">{item.display_quantity} <span className="text-xs text-gray-500">{item.display_unit}</span></div>
                            </td>
                          <td className="p-3 text-right font-mono">
                            <div className="flex items-center justify-end gap-1">
                              <span>Rp</span>
                              <input
                                type="text"
                                className="w-24 bg-white border border-gray-300 px-2 py-1 text-right focus:outline-none focus:border-black rounded-none"
                                value={item.display_price === 0 ? "" : item.display_price}
                                onChange={(e) => updateItemPrice(index, e.target.value)}
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
                {/* Customer Details */}
                <div className="mb-4 grid grid-cols-2 gap-4 border-b border-gray-300 pb-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 text-gray-700">Nama Customer (Opsional)</label>
                    <input type="text" className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors" value={customerName} onChange={e => setCustomerName(e.target.value.toUpperCase())} placeholder="Mis: PAK BUDI" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 text-gray-700">No. Telp (Opsional)</label>
                    <input type="text" className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Mis: 0812..." />
                  </div>
                  <div className="col-span-2 flex gap-4 mt-2">
                    <label className="flex items-center gap-2 font-bold text-sm cursor-pointer bg-white px-4 py-2 border border-black rounded shadow-sm hover:bg-gray-50 transition-colors">
                      <input type="radio" name="paymentStatus" checked={paymentStatus === 'LUNAS'} onChange={() => setPaymentStatus('LUNAS')} className="w-4 h-4 accent-black" />
                      BAYAR LUNAS
                    </label>
                    <label className="flex items-center gap-2 font-bold text-sm cursor-pointer bg-white px-4 py-2 border border-black rounded shadow-sm hover:bg-gray-50 transition-colors">
                      <input type="radio" name="paymentStatus" checked={paymentStatus === 'DP'} onChange={() => setPaymentStatus('DP')} className="w-4 h-4 accent-black" />
                      BAYAR DP / NYICIL
                    </label>
                  </div>
                  {paymentStatus === 'DP' && (
                    <div className="col-span-2 animate-fade-in mt-2">
                      <label className="block text-xs font-bold uppercase mb-1 text-blue-800">Nominal DP Dibayar (Rp)</label>
                      <input type="number" className="w-full p-3 border-2 border-blue-600 bg-white font-mono text-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all" value={dpAmount} onChange={e => setDpAmount(e.target.value)} placeholder="Ketik nominal uang muka..." />
                    </div>
                  )}
                </div>

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

              <div className="flex flex-col gap-4 bg-gray-100 p-4">
                {(() => {
                  const grouped = transactions.reduce((acc, t) => {
                    const key = t.created_at;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(t);
                    return acc;
                  }, {} as Record<string, Transaction[]>);
                  
                  const notas = Object.entries(grouped).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
                  
                  if (notas.length === 0) {
                    return <div className="p-8 text-center text-gray-500 italic border border-black bg-white">Belum ada transaksi hari ini.</div>;
                  }

                  return notas.map(([time, items], idx) => {
                      const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
                      return (
                        <div key={time} className="border-2 border-black bg-white overflow-hidden shadow-sm">
                          <div className="bg-black text-white p-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="bg-white text-black px-2 py-0.5 font-black text-xs">NOTA #{notas.length - idx}</span>
                              <span className="text-sm">{format(new Date(time), "HH:mm")}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-green-400 font-bold">Total: Rp {totalNota.toLocaleString("id-ID")}</div>
                                {items[0]?.payment_status === 'DP' && (
                                  <div className="bg-yellow-500 text-black px-2 py-0.5 text-xs font-bold animate-pulse rounded border border-black">BELUM LUNAS</div>
                                )}
                                <div className="flex gap-2">
                                  {items[0]?.payment_status === 'DP' && (
                                    <button onClick={() => lunasiNota(items)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs font-bold rounded transition-colors border border-green-800 shadow-[2px_2px_0_0_#000]">LUNASKAN</button>
                                  )}
                                <button onClick={() => editFullNota(items)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-bold rounded transition-colors border border-blue-800">Edit</button>
                                <button onClick={() => deleteFullNota(items)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-bold rounded transition-colors border border-red-800">Hapus</button>
                              </div>
                            </div>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {items.map((item, itemIdx) => (
                                <tr key={item.id} className={`${itemIdx !== items.length - 1 ? 'border-b border-gray-200' : ''} hover:bg-gray-50`}>
                                  <td className="p-3 font-bold text-gray-800">
                                    {item.materials?.code && <span className="text-xs font-mono bg-gray-200 px-1 py-0.5 rounded mr-2 border border-black">[{item.materials.code}]</span>}
                                    {displayMaterialName(item.materials?.name)}
                                  </td>
                                  <td className="p-3 text-center w-24 font-mono">{item.quantity} x</td>
                                  <td className="p-3 text-right text-green-700 font-bold font-mono w-32">Rp {item.total_price.toLocaleString("id-ID")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    });
                })()}
              </div>

</div>
        </div>
      </div>
    </div>
  );
}




















