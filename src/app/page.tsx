"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { PlusCircle, ShoppingCart, ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
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

export default function POSDashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]); // For summary
  
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('OUT');
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialBudget, setInitialBudget] = useState<number>(0);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [activeStore] = useState<string>("karya_bahan");
  const [transactionDate, setTransactionDate] = useState("");

  useEffect(() => {
    fetchData("karya_bahan");

    // Set default datetime to local current time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setTransactionDate(now.toISOString().slice(0, 16));

    // Subscribe to real-time changes
    const materialSubscription = supabase
      .channel("public:materials")
      .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, () => {
        fetchMaterials(store);
      })
      .subscribe();

    const transactionSubscription = supabase
      .channel("public:transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions(store);
      })
      .subscribe();

    // Load initial budget from localStorage (per store)
    const savedBudget = localStorage.getItem(`karyabahan_initial_budget_${store}`);
    if (savedBudget) {
      setInitialBudget(Number(savedBudget));
    } else {
      setInitialBudget(0);
    }

    return () => {
      supabase.removeChannel(materialSubscription);
      supabase.removeChannel(transactionSubscription);
    };
  }, []);

  function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(tempBudget);
    setInitialBudget(val);
    localStorage.setItem(`karyabahan_initial_budget_${activeStore}`, val.toString());
    setIsEditingBudget(false);
  }

  async function fetchData(store: string) {
    await fetchMaterials(store);
    await fetchTransactions(store);
  }

  async function fetchMaterials(store: string) {
    const { data } = await supabase.from("materials").select("*").eq("store", store).order("name");
    if (data) setMaterials(data);
  }

  async function fetchTransactions(store: string) {
    // Fetch recent for the table (only active ones)
    const { data: recent } = await supabase
      .from("transactions")
      .select("*, materials(name)")
      .eq("store", store)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (recent) setTransactions(recent);

    // Fetch all for summary (only active ones)
    const { data: all } = await supabase
      .from("transactions")
      .select("type, total_price")
      .eq("store", store)
      .is("deleted_at", null);
    if (all) setAllTransactions(all as Transaction[]);
  }

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);
  const calculatedPrice = selectedMaterial ? selectedMaterial.price * Number(quantity || 0) : 0;
  
  // If IN, customPrice is Modal per Pcs, so Total = Modal per Pcs * Quantity
  const finalPrice = transactionType === 'IN' 
    ? (customPrice !== "" ? Number(customPrice) * Number(quantity || 0) : 0) 
    : calculatedPrice;

  const totalRevenue = allTransactions.filter(t => t.type === 'OUT').reduce((sum, t) => sum + Number(t.total_price), 0);
  const totalExpense = allTransactions.filter(t => t.type === 'IN').reduce((sum, t) => sum + Number(t.total_price), 0);
  const netBalance = totalRevenue - totalExpense;
  const currentBudget = initialBudget + netBalance;

  async function handleTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMaterialId || quantity === "" || Number(quantity) <= 0 || finalPrice <= 0) return;

    setLoading(true);
    
    // For OUT, cost_price is what's in the DB. For IN, calculate inferred cost_price or fallback to DB cost.
    let transactionCostPrice = selectedMaterial?.cost_price || 0;
    if (transactionType === 'IN' && quantity && finalPrice) {
       transactionCostPrice = finalPrice / Number(quantity);
       // Optional: We could update the materials table to average the cost price here, but let's keep it simple for now
    }

    const insertData: any = {
      material_id: selectedMaterialId,
      type: transactionType,
      quantity: Number(quantity),
      cost_price: transactionCostPrice,
      total_price: finalPrice,
      store: activeStore
    };

    if (transactionDate) {
      insertData.created_at = new Date(transactionDate).toISOString();
    }

    const { error } = await supabase.from("transactions").insert([insertData]);

    setLoading(false);
    if (!error) {
      setSelectedMaterialId("");
      setQuantity("");
      setCustomPrice("");
    } else {
      console.error(error);
      alert("Error processing transaction");
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
      alert("Error menghapus transaksi: " + error.message);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      
      {/* Financial Summary */}
      <div>
        <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          FINANCIAL SUMMARY
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-black p-6 bg-white">
            <div className="text-sm font-bold uppercase text-gray-500 mb-2 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
              Total Penjualan (Revenue)
            </div>
            <div className="text-3xl font-mono font-bold text-green-700">
              Rp {totalRevenue.toLocaleString("id-ID")}
            </div>
          </div>
          <div className="border border-black p-6 bg-white">
            <div className="text-sm font-bold uppercase text-gray-500 mb-2 flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
              Total Pembelian (Expense)
            </div>
            <div className="text-3xl font-mono font-bold text-red-700">
              Rp {totalExpense.toLocaleString("id-ID")}
            </div>
          </div>
          <div className="border border-black p-6 bg-black text-white relative">
            <div className="text-sm font-bold uppercase text-gray-400 mb-2 flex justify-between items-center">
              <span>Sisa Saldo Kas (Budget)</span>
              <button onClick={() => { setIsEditingBudget(true); setTempBudget(initialBudget.toString()); }} className="text-xs border border-gray-600 px-2 py-1 hover:bg-gray-800 transition-colors">
                Set Modal Awal
              </button>
            </div>
            
            {isEditingBudget ? (
              <form onSubmit={saveBudget} className="flex gap-2 mt-2">
                <input 
                  type="number" 
                  className="flex-1 bg-transparent border-b border-white text-white focus:outline-none" 
                  value={tempBudget}
                  onChange={e => setTempBudget(e.target.value)}
                  placeholder="Modal Awal"
                  autoFocus
                />
                <button type="submit" className="text-xs bg-white text-black px-2 font-bold uppercase">Save</button>
                <button type="button" onClick={() => setIsEditingBudget(false)} className="text-xs text-gray-400 px-2">X</button>
              </form>
            ) : (
              <div className="text-3xl font-mono font-bold">
                Rp {currentBudget.toLocaleString("id-ID")}
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-2">
              (Modal: Rp {initialBudget.toLocaleString("id-ID")} + Profit: Rp {netBalance.toLocaleString("id-ID")})
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* POS Form */}
        <div className="lg:col-span-1">
          <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            NEW TRANSACTION
          </h2>
          
          <form onSubmit={handleTransaction} className="space-y-6">
            
            {/* Transaction Date */}
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-wide">Tanggal Transaksi</label>
              <input
                type="datetime-local"
                className="w-full border border-black p-3 bg-transparent focus:outline-none focus:ring-1 focus:ring-black"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
            </div>

            {/* Transaction Type Toggle */}
            <div className="flex gap-4">
              <label className="flex-1 cursor-pointer">
                <input 
                  type="radio" 
                  name="type" 
                  value="OUT" 
                  className="peer sr-only"
                  checked={transactionType === 'OUT'}
                  onChange={() => setTransactionType('OUT')}
                />
                <div className="text-center p-3 border border-black font-bold uppercase peer-checked:bg-black peer-checked:text-white transition-colors">
                  Jual Barang
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input 
                  type="radio" 
                  name="type" 
                  value="IN" 
                  className="peer sr-only"
                  checked={transactionType === 'IN'}
                  onChange={() => setTransactionType('IN')}
                />
                <div className="text-center p-3 border border-black font-bold uppercase peer-checked:bg-black peer-checked:text-white transition-colors">
                  Beli Bahan
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 uppercase">Material</label>
              <select
                className="w-full border border-black p-3 bg-transparent appearance-none focus:outline-none focus:ring-1 focus:ring-black"
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                required
              >
                <option value="" disabled>Select material...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id} disabled={transactionType === 'OUT' && m.current_stock <= 0}>
                    {m.name} (Stock: {m.current_stock})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 uppercase">Quantity</label>
              <input
                type="number"
                min="1"
                max={transactionType === 'OUT' ? (selectedMaterial?.current_stock || 1) : undefined}
                className="w-full border border-black p-3 bg-transparent focus:outline-none focus:ring-1 focus:ring-black"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/^0+(?=\d)/, ''))}
                placeholder="Jumlah barang"
                required
              />
            </div>

            {transactionType === 'IN' && (
              <div>
                <label className="block text-sm font-bold mb-2 uppercase text-red-600">Harga Modal / Pcs (Rp)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-black p-3 bg-transparent focus:outline-none focus:ring-1 focus:ring-black"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
                  placeholder="Contoh: 50000"
                  required
                />
              </div>
            )}

            <div className="pt-4 border-t border-gray-300">
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold uppercase">Total</span>
                <span className={`font-mono font-bold ${transactionType === 'IN' ? 'text-red-600' : 'text-green-600'}`}>
                  Rp {finalPrice.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedMaterialId || quantity === "" || Number(quantity) <= 0 || finalPrice <= 0}
              className="w-full bg-black text-white p-4 font-bold uppercase tracking-wider hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex justify-center items-center gap-2"
            >
              {loading ? "PROCESSING..." : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  SUBMIT
                </>
              )}
            </button>
          </form>
        </div>

        {/* Recent Transactions & Stock */}
        <div className="lg:col-span-2 space-y-12">
          <div>
            <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">
              RECENT TRANSACTIONS
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-100 uppercase tracking-wide">
                    <th className="p-3 border-b-2 border-black font-bold">Type</th>
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
                      <td colSpan={6} className="p-8 text-center text-gray-500 italic">No active transactions found.</td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="p-3 border-b border-gray-200">
                          {t.type === 'IN' ? (
                            <span className="bg-red-100 text-red-800 px-2 py-1 text-xs font-bold rounded-sm border border-red-200">BELI (IN)</span>
                          ) : (
                            <span className="bg-green-100 text-green-800 px-2 py-1 text-xs font-bold rounded-sm border border-green-200">JUAL (OUT)</span>
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {format(new Date(t.created_at), "dd MMM yyyy, HH:mm")}
                        </td>
                        <td className="p-3 border-b border-gray-200 font-medium">
                          {t.materials?.name || "Unknown"}
                        </td>
                        <td className="p-3 border-b border-gray-200 text-right font-mono">
                          {t.quantity}
                        </td>
                        <td className={`p-3 border-b border-gray-200 text-right font-mono font-bold ${t.type === 'IN' ? 'text-red-600' : 'text-green-600'}`}>
                          {t.type === 'IN' ? '-' : '+'} {t.total_price.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 border-b border-gray-200 text-center">
                          <button 
                            onClick={() => softDeleteTransaction(t.id)}
                            className="text-xs border border-red-500 text-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-colors"
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
          
          <div>
            <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">
              CURRENT INVENTORY
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {materials.map((m) => (
                <div key={m.id} className="border border-black p-4 flex flex-col justify-between">
                  <div className="text-sm font-bold uppercase mb-2 truncate" title={m.name}>{m.name}</div>
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-500">Stock</div>
                    <div className={`text-2xl font-mono font-bold ${m.current_stock <= 10 ? "text-red-600" : ""}`}>
                      {m.current_stock}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
