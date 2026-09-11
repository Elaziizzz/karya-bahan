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
  const [paymentMode, setPaymentMode] = useState<"LUNAS" | "DP" | "PELUNASAN">("LUNAS");
  const [unpaidTransactions, setUnpaidTransactions] = useState<Transaction[]>([]);
  const [selectedDebtKey, setSelectedDebtKey] = useState<string>("");
  const [pelunasanAmount, setPelunasanAmount] = useState<string>("");
  const [dpAmount, setDpAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("");

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
    if (receiptData) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
    }
  }, [receiptData]);

  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setTransactionDate(now.toISOString().slice(0, 16));

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
    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("store", store)
      .is("deleted_at", null)
      .order("name");
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

    // Fetch ALL unpaid transactions for Pelunasan
    const { data: unpaid } = await supabase
      .from("transactions")
      .select("*, materials(name, code)")
      .eq("store", store)
      .eq("type", "OUT")
      .eq("payment_status", "DP")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (unpaid) setUnpaidTransactions(unpaid as Transaction[]);

    const { data: all } = await supabase
      .from("transactions")
      .select("type, total_price, created_at")
      .eq("store", store)
      .is("deleted_at", null);
    if (all) setAllTransactions(all as Transaction[]);
  }

  // Group unpaid debts by nota
  const unpaidDebts = useMemo(() => {
    const groups: Record<string, {
      timeKey: string;
      invoiceNo: string;
      created_at: string;
      customer_name: string;
      customer_phone: string;
      items: Transaction[];
      totalAmount: number;
      dpAmount: number;
      remainingDebt: number;
    }> = {};

    unpaidTransactions.forEach((t) => {
      const key = t.created_at;
      if (!groups[key]) {
        groups[key] = {
          timeKey: key,
          invoiceNo: `KB-${new Date(key).getTime()}`,
          created_at: key,
          customer_name: t.customer_name && t.customer_name !== '-' ? t.customer_name : 'Tanpa Nama',
          customer_phone: t.customer_phone || '-',
          items: [],
          totalAmount: 0,
          dpAmount: Number(t.dp_amount) || 0,
          remainingDebt: 0,
        };
      }
      groups[key].items.push(t);
      groups[key].totalAmount += Number(t.total_price || 0);
    });

    return Object.values(groups)
      .map((g) => {
        const dp = Number(g.items[0]?.dp_amount) || 0;
        const sisa = Math.max(0, g.totalAmount - dp);
        return {
          ...g,
          dpAmount: dp,
          remainingDebt: sisa,
        };
      })
      .filter((g) => g.remainingDebt > 0);
  }, [unpaidTransactions]);

  const selectedDebt = useMemo(() => {
    return unpaidDebts.find((d) => d.timeKey === selectedDebtKey) || null;
  }, [unpaidDebts, selectedDebtKey]);

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

  async function handleProcessPelunasan() {
    if (!selectedDebt) return;
    const payVal = Number(pelunasanAmount);
    if (!payVal || payVal <= 0) {
      alert("Masukkan nominal pembayaran!");
      return;
    }
    if (payVal > selectedDebt.remainingDebt) {
      alert(`Nominal tidak boleh melebihi sisa hutang (Maks: Rp ${selectedDebt.remainingDebt.toLocaleString("id-ID")})`);
      return;
    }

    setLoading(true);
    const newDp = selectedDebt.dpAmount + payVal;
    const isFullLunas = newDp >= selectedDebt.totalAmount;
    const newStatus = isFullLunas ? "LUNAS" : "DP";

    const ids = selectedDebt.items.map(i => i.id);
    const { error } = await supabase
      .from("transactions")
      .update({
        dp_amount: newDp,
        payment_status: newStatus
      })
      .in("id", ids);

    if (error) {
      alert("Gagal memproses pelunasan: " + error.message);
      setLoading(false);
      return;
    }

    showToast(isFullLunas ? "Pelunasan berhasil! Hutang sudah LUNAS." : `Pembayaran cicilan Rp ${payVal.toLocaleString("id-ID")} berhasil dicatat!`, "success");

    // Sync to Google Sheets
    try {
      const year = new Date(selectedDebt.created_at).getFullYear().toString();
      fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pelunasan',
          payload: {
            invoiceNo: selectedDebt.invoiceNo,
            total: selectedDebt.totalAmount,
            dp: newDp,
            sisa: Math.max(0, selectedDebt.totalAmount - newDp),
            status: newStatus
          },
          year
        })
      }).catch(console.error);
    } catch (e) {
      console.error(e);
    }

    // Set receipt data for proof of payment
    setReceiptData({
      invoiceNo: selectedDebt.invoiceNo,
      date: new Date(),
      items: selectedDebt.items.map(t => {
        const mat = materials.find(m => m.id === t.material_id) || {
          id: t.material_id,
          name: t.materials?.name || "-",
          price: t.total_price / t.quantity,
          cost_price: t.cost_price,
          store: activeStore,
          current_stock: 0
        };
        return {
          material: mat,
          quantity: t.quantity,
          subtotal: t.total_price,
          display_quantity: t.quantity,
          display_unit: 'Pcs',
          display_price: Math.round(t.total_price / t.quantity),
          pack_multiplier: 1
        };
      }),
      total: selectedDebt.totalAmount,
      customerName: selectedDebt.customer_name,
      customerPhone: selectedDebt.customer_phone,
      paymentStatus: newStatus,
      dpAmount: newDp
    });

    setSelectedDebtKey("");
    setPelunasanAmount("");
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

    // Calculate how much of this item is ALREADY in the cart
    const existingInCart = cart
      .filter(item => item.material.id === selectedMaterial.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    const totalRequestedQty = existingInCart + baseQtyNum;

    if (totalRequestedQty > selectedMaterial.current_stock) {
      const remainingAvailable = Math.max(0, selectedMaterial.current_stock - existingInCart);
      showToast(
        `Stok tidak cukup! Sisa stok tersedia: ${remainingAvailable} ${baseUnit} (Sudah di keranjang: ${existingInCart} ${baseUnit})`,
        "error"
      );
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

    // Final pre-checkout stock verification directly against database
    const cartMaterialIds = Array.from(new Set(cart.map(item => item.material.id)));
    const { data: currentMats, error: stockCheckErr } = await supabase
      .from("materials")
      .select("id, name, current_stock")
      .in("id", cartMaterialIds);

    if (stockCheckErr || !currentMats) {
      showToast("Gagal memverifikasi stok barang. Silakan coba lagi.", "error");
      setLoading(false);
      return;
    }

    for (const mat of currentMats) {
      const totalQtyInCart = cart
        .filter(item => item.material.id === mat.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (totalQtyInCart > mat.current_stock) {
        showToast(
          `Checkout gagal! Stok "${displayMaterialName(mat.name)}" tidak mencukupi (Tersedia: ${mat.current_stock}, Diminta: ${totalQtyInCart}).`,
          "error"
        );
        setLoading(false);
        fetchData(activeStore);
        return;
      }
    }

    const txDate = transactionDate ? new Date(transactionDate) : new Date();
    const invoiceNo = `KB-${txDate.getTime()}`;

    const isDp = paymentMode === "DP";
    const dpNum = isDp ? (Number(dpAmount) || 0) : cartTotal;

    const insertData = cart.map(item => ({
      material_id: item.material.id,
      type: 'OUT' as const,
      quantity: item.quantity,
      cost_price: item.material.cost_price,
      total_price: item.subtotal,
      store: activeStore,
      created_at: txDate.toISOString(),
      customer_name: customerName.trim() || "-",
      customer_phone: customerPhone.trim() || "-",
      payment_status: isDp ? "DP" : "LUNAS",
      dp_amount: dpNum
    }));

    const { data: insertedData, error } = await supabase.from("transactions").insert(insertData).select('id');

    setLoading(false);
    if (!error) {
      // Sync to Google Sheets
      if (insertedData) {
        try {
          const year = txDate.getFullYear().toString();
          const notaItemsText = cart.map(item => `${item.display_quantity} ${item.display_unit} ${displayMaterialName(item.material.name).replace(/-\s*\[.*?\]$/, '').trim()}`).join(', ');
          const grandTotal = cartTotal;
          const sisaValue = Math.max(0, grandTotal - dpNum);
          
          const sheetPayload = [[
            invoiceNo,
            format(txDate, "yyyy-MM-dd"),
            format(txDate, "HH:mm"),
            activeStore === 'karya_bahan' ? 'Karya Bahan' : 'Bysca',
            'JUAL (OUT) - NOTA',
            notaItemsText,
            '1 Nota',
            grandTotal,
            isDp ? 'BELUM LUNAS' : 'VALID',
            customerName.trim() || '-',
            customerPhone.trim() || '-',
            isDp ? "DP" : "LUNAS",
            dpNum,
            sisaValue
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
        date: txDate,
        items: [...cart],
        total: cartTotal,
        customerName: customerName.trim() || "-",
        customerPhone: customerPhone.trim() || "-",
        paymentStatus: isDp ? "DP" : "LUNAS",
        dpAmount: dpNum
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMode("LUNAS");
      setDpAmount("");
      const resetNow = new Date();
      resetNow.setMinutes(resetNow.getMinutes() - resetNow.getTimezoneOffset());
      setTransactionDate(resetNow.toISOString().slice(0, 16));
      fetchData(activeStore);
    } else {
      console.error(error);
      showToast("Gagal menyimpan transaksi: " + error.message, "error");
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
        const item = filteredMaterials[highlightedIndex];
        if (item.current_stock <= 0) {
          showToast(`Stok "${displayMaterialName(item.name)}" HABIS (0)! Silakan restok dulu.`, "error");
          return;
        }
        selectMaterial(item);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-12 animate-fade-in print:p-0 print:m-0 print:space-y-0 print:max-w-none">
      
      {/* Receipt Modal (Only visible when receiptData exists, and hides other content when printing) */}
      {receiptData && (() => {
        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.max(1, Math.ceil((receiptData.items?.length || 0) / ITEMS_PER_PAGE));
        return (
          <div className="receipt-modal-root fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/60 overflow-y-auto p-2 sm:p-4 print:p-0 print:static print:bg-white print:z-auto print:block print:w-[180mm] print:mx-auto print:overflow-visible">
            <div className="relative max-w-3xl w-full mx-auto my-auto print:my-0 print:max-w-none print:w-[180mm] print:mx-auto">
              {/* Action Buttons (Hidden when printing) */}
              <div className="flex justify-end gap-2 mb-2 print:hidden sticky top-0 z-10">
                <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded transition-colors flex items-center gap-2 font-bold shadow-lg" title="Cetak">
                  <Printer className="w-5 h-5" />
                  Cetak Struk
                </button>
                <button onClick={() => setReceiptData(null)} className="p-2 bg-gray-200 hover:bg-red-500 hover:text-white rounded transition-colors shadow-lg" title="Tutup">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Receipt Pages List (10 items max per page, 95mm height for Margin: Default) */}
              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const pageItems = receiptData.items.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);
                const isLastPage = pageIdx === totalPages - 1;
                return (
                  <div
                    key={pageIdx}
                    translate="no"
                    className={`notranslate receipt-page bg-white p-4 sm:p-5 pt-5 shadow-2xl relative print:shadow-none print:p-0 print:pt-0.5 print:pb-0.5 print:max-w-none print:w-[180mm] print:mx-auto text-black font-mono print:font-mono w-full max-w-[180mm] mx-auto text-[13px] leading-tight flex flex-col justify-between min-h-[96mm] print:min-h-[96mm] print:h-auto mb-3 print:mb-0 box-border ${!isLastPage ? "receipt-page-break print:break-after-page" : ""}`}
                  >
                    {/* 1. Header (Pinned at Top) */}
                    <div className="shrink-0 mb-1.5">
                      <div className="flex justify-between items-start mb-1 text-[13px]">
                        <div className="max-w-[92mm] leading-tight space-y-0.5">
                          <h2 className="text-[15.5px] font-bold tracking-wider">{activeStore === 'karya_bahan' ? 'KARYA BAHAN JAYA PLAVON' : 'BYSCA'}</h2>
                          <p>Alamat: {activeStore === 'karya_bahan' ? 'Jl.Raya Barat No.6 Kasturi Cikijing,Majalengka' : '-'}</p>
                          <p>Telp  : {activeStore === 'karya_bahan' ? '081323299754 / 085722328871' : '-'}</p>
                          <p className="mt-0.5">Customer: <b>{receiptData.customerName || "-"}</b> {receiptData.customerPhone && receiptData.customerPhone !== '-' ? `(${receiptData.customerPhone})` : ''}</p>
                        </div>
                        <div className="text-center pt-0.5">
                          <h1 className="text-2xl font-bold tracking-[0.2em]">FAKTUR</h1>
                          <div className="text-[11px] mt-0.5">Hal : {pageIdx + 1} / {totalPages}</div>
                        </div>
                        <div className="text-right text-[13px] leading-tight space-y-0.5">
                          <div>Tanggal   : {format(receiptData.date, "dd-MMM-yyyy HH:mm")}</div>
                          <div>No. Faktur: {receiptData.invoiceNo}</div>
                          <div>Kasir     : Admin</div>
                          <div>Status    : <b className="uppercase">{receiptData.paymentStatus === 'DP' ? 'Cicilan / DP' : 'Lunas'}</b></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 2. Table Area (Flex-1 fills middle, 10 items max) */}
                    <div className="flex-1 flex flex-col justify-start">
                      <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                          <tr className="border-t border-b border-black border-dashed">
                            <th className="py-1 font-bold w-8 text-center">NO.</th>
                            <th className="py-1 font-bold">NAMA BARANG</th>
                            <th className="py-1 font-bold text-right w-22">QTY</th>
                            <th className="py-1 font-bold text-right w-22">HARGA</th>
                            <th className="py-1 font-bold text-right w-26">JUMLAH</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100 print:border-none">
                              <td className="py-1 text-center align-top">{pageIdx * ITEMS_PER_PAGE + idx + 1}</td>
                              <td className="py-1 align-top">
                                {item.material.code ? `[${item.material.code}] ` : ''}
                                {displayMaterialName(item.material.name).replace(/-\s*\[.*?\]$/, '').trim()}
                              </td>
                              <td className="py-1 text-right align-top whitespace-nowrap">
                                {item.display_quantity} {item.display_unit.toUpperCase()}
                              </td>
                              <td className="py-1 text-right align-top whitespace-nowrap">{item.display_price.toLocaleString("id-ID")}</td>
                              <td className="py-1 text-right align-top font-bold whitespace-nowrap">{item.subtotal.toLocaleString("id-ID")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* 3. Footer (Always Pinned at Bottom, Safe with Margin: Default) */}
                    <div className="shrink-0 border-t border-black border-dashed pt-1.5 text-[13px]">
                      <div className="flex justify-between items-stretch">
                        <div className="text-center w-36 flex flex-col justify-between self-stretch">
                          <p className="font-medium">Tanda Terima</p>
                          <p className="whitespace-nowrap font-mono tracking-tighter text-[12.5px] select-none mt-auto py-0.5">(....................)</p>
                        </div>
                        <div className="text-center w-36 flex flex-col justify-between self-stretch">
                          <p className="font-medium">Hormat Kami</p>
                          <p className="whitespace-nowrap font-mono tracking-tighter text-[12.5px] select-none mt-auto py-0.5">(....................)</p>
                        </div>
                        <div className="w-56 text-right text-[13px]">
                          <div className="flex justify-between py-0.5">
                            <span>Sub Total:</span>
                            <span className="font-semibold">Rp {receiptData.total.toLocaleString("id-ID")}</span>
                          </div>
                          <div className="flex justify-between py-0.5 font-bold border-t border-dashed border-gray-400">
                            <span>Total:</span>
                            <span className="text-[14.5px]">Rp {receiptData.total.toLocaleString("id-ID")}</span>
                          </div>
                          {(receiptData.paymentStatus === 'DP' || (receiptData.dpAmount && receiptData.dpAmount < receiptData.total)) && (
                            <div className="border-t border-black border-dashed mt-0.5 pt-0.5">
                              <div className="flex justify-between py-0.5 font-bold">
                                <span>Tunai / DP:</span>
                                <span>Rp {receiptData.dpAmount.toLocaleString("id-ID")}</span>
                              </div>
                              <div className="flex justify-between py-0.5 font-bold text-[12px] mt-0.5">
                                <span>SISA KURANG:</span>
                                <span>Rp {(receiptData.total - receiptData.dpAmount).toLocaleString("id-ID")}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Print Instruction (Hidden when printing, compact details) */}
              <details className="text-center text-xs mt-2 print:hidden text-gray-600 bg-blue-50/90 p-2 rounded border border-blue-200 max-w-[180mm] mx-auto cursor-pointer">
                <summary className="font-bold text-blue-900 select-none">Petunjuk Cetak Envelope C5 (Klik jika perlu)</summary>
                <div className="mt-1 space-y-0.5 text-[11px] text-blue-800 text-left px-2">
                  <p>1. Ukuran Kertas: Pilih <b>Envelope C5 229 x 162 mm</b> atau <b>Letter Fanfold 8 1/2 x 11 in</b>.</p>
                  <p>2. Margin: Pilih <b>Default</b> (posisi otomatis pas di tengah).</p>
                  <p>3. <b>Hilangkan centang &quot;Header dan footer&quot;</b>.</p>
                </div>
              </details>
            </div>
          </div>
        );
      })()}

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
                      filteredMaterials.map((m, index) => {
                        const isOutOfStock = m.current_stock <= 0;
                        return (
                          <div
                            key={m.id}
                            className={`p-3 border-b border-gray-100 transition-colors flex justify-between items-center ${
                              isOutOfStock 
                                ? 'bg-red-50/60 opacity-60 cursor-not-allowed' 
                                : 'cursor-pointer hover:bg-gray-100'
                            } ${selectedMaterialId === m.id ? 'bg-gray-200 font-bold' : ''} ${
                              highlightedIndex === index ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (isOutOfStock) {
                                showToast(`Stok "${displayMaterialName(m.name)}" HABIS (0)! Silakan restok dulu.`, "error");
                                return;
                              }
                              selectMaterial(m);
                            }}
                            onMouseEnter={() => !isOutOfStock && setHighlightedIndex(index)}
                          >
                            <div className="flex items-center gap-2">
                              {m.code && <span className="text-xs font-mono bg-white px-1 py-0.5 rounded border border-black">{m.code}</span>}
                              <span className={isOutOfStock ? 'line-through text-gray-500' : ''}>{displayMaterialName(m.name)}</span>
                              {isOutOfStock && <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded shadow-sm">HABIS</span>}
                            </div>
                            <div className={`text-xs font-mono ${isOutOfStock ? 'text-red-600 font-bold' : 'text-gray-500'}`}>Stock: {m.current_stock}</div>
                          </div>
                        );
                      })
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
                {/* 3 Payment Modes */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase mb-2 text-gray-700">PILIH STATUS / METODE TRANSAKSI:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('LUNAS')}
                      className={`p-3 font-bold text-xs uppercase border-2 border-black rounded transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 ${paymentMode === 'LUNAS' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                    >
                      <span>BAYAR LUNAS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('DP')}
                      className={`p-3 font-bold text-xs uppercase border-2 border-black rounded transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 ${paymentMode === 'DP' ? 'bg-amber-400 text-black border-black' : 'bg-white text-black hover:bg-gray-200'}`}
                    >
                      <span>BAYAR DP / NYICIL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('PELUNASAN')}
                      className={`p-3 font-bold text-xs uppercase border-2 border-black rounded transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 relative ${paymentMode === 'PELUNASAN' ? 'bg-green-600 text-white border-black' : 'bg-white text-black hover:bg-gray-200'}`}
                    >
                      <span>PELUNASAN</span>
                      {unpaidDebts.length > 0 && (
                        <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 animate-pulse">
                          {unpaidDebts.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* If Mode is PELUNASAN */}
                {paymentMode === 'PELUNASAN' ? (
                  <div className="space-y-4 border-t-2 border-black pt-4 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold uppercase mb-1 text-gray-800">
                        PILIH NAMA PEMILIK HUTANG:
                      </label>
                      {unpaidDebts.length === 0 ? (
                        <div className="p-4 bg-green-50 border-2 border-green-600 text-green-900 rounded font-bold text-center text-sm">
                          Semua tagihan hutang sudah lunas! Tidak ada customer yang punya sisa hutang saat ini.
                        </div>
                      ) : (
                        <select
                          value={selectedDebtKey}
                          onChange={(e) => {
                            setSelectedDebtKey(e.target.value);
                            setPelunasanAmount("");
                          }}
                          className="w-full p-3 border-2 border-black bg-white font-bold text-sm focus:outline-none focus:ring-4 focus:ring-green-300"
                        >
                          <option value="">-- PILIH NAMA CUSTOMER ({unpaidDebts.length} BELUM LUNAS) --</option>
                          {unpaidDebts.map((d) => (
                            <option key={d.timeKey} value={d.timeKey}>
                              {d.customer_name} | Sisa Hutang: Rp {d.remainingDebt.toLocaleString('id-ID')} ({format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedDebt && (
                      <div className="bg-white border-2 border-green-700 p-4 shadow-[4px_4px_0_0_#000] space-y-3 animate-fade-in">
                        <div className="flex justify-between items-start border-b border-gray-300 pb-2">
                          <div>
                            <span className="text-xs text-gray-500 font-bold uppercase">Nama Customer:</span>
                            <div className="text-lg font-black text-black">{selectedDebt.customer_name}</div>
                            {selectedDebt.customer_phone !== '-' && (
                              <div className="text-xs text-gray-600 font-mono">Telp: {selectedDebt.customer_phone}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500 font-bold uppercase">Waktu Nota:</span>
                            <div className="text-xs font-mono font-bold text-gray-700">{format(new Date(selectedDebt.created_at), "dd MMM yyyy HH:mm")}</div>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 bg-gray-50 p-2 border border-gray-200">
                          <span className="font-bold">Barang di Nota: </span>
                          {selectedDebt.items.map(i => `${i.quantity}x ${displayMaterialName(i.materials?.name)}`).join(", ")}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-gray-300 pb-2">
                          <div>
                            <span className="text-gray-500">Total Belanja:</span><div className="font-bold font-mono text-sm">Rp {selectedDebt.totalAmount.toLocaleString("id-ID")}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Sudah Dibayar (DP):</span><div className="font-bold font-mono text-sm text-blue-700">Rp {selectedDebt.dpAmount.toLocaleString("id-ID")}</div>
                          </div>
                        </div>

                        <div className="bg-red-50 border border-red-300 p-3 rounded flex justify-between items-center">
                          <span className="font-bold text-xs uppercase text-red-700">SISA HUTANG SAAT INI:</span>
                          <span className="font-mono text-2xl font-black text-red-600">
                            Rp {selectedDebt.remainingDebt.toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold uppercase text-green-900">
                              Nominal Yang Dibayarkan (Rp):
                            </label>
                            <button
                              type="button"
                              onClick={() => setPelunasanAmount(String(selectedDebt.remainingDebt))}
                              className="text-xs bg-green-700 hover:bg-green-800 text-white px-2.5 py-1 font-bold rounded shadow-sm transition-colors"
                            >
                              LUNASI SEMUA (Rp {selectedDebt.remainingDebt.toLocaleString("id-ID")})
                            </button>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max={selectedDebt.remainingDebt}
                            className="w-full p-3 border-2 border-green-600 font-mono text-2xl font-black bg-white focus:outline-none focus:ring-4 focus:ring-green-200"
                            value={pelunasanAmount}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val > selectedDebt.remainingDebt) {
                                setPelunasanAmount(String(selectedDebt.remainingDebt));
                              } else {
                                setPelunasanAmount(e.target.value.replace(/^0+(?=\d)/, ''));
                              }
                            }}
                            placeholder="Ketik nominal uang..."
                          />
                          <p className="text-[11px] text-gray-500 mt-1">
                            *Nominal tidak bisa melebihi sisa hutang (Maksimal: Rp {selectedDebt.remainingDebt.toLocaleString("id-ID")})
                          </p>

                          {Number(pelunasanAmount) === selectedDebt.remainingDebt && (
                            <div className="mt-2 text-xs bg-green-100 border border-green-500 text-green-800 p-2 font-bold rounded text-center">
                              Akan LUNAS PENUH! Nama customer ini akan otomatis hilang dari daftar hutang setelah diproses.
                            </div>
                          )}

                          {Number(pelunasanAmount) > 0 && Number(pelunasanAmount) < selectedDebt.remainingDebt && (
                            <div className="mt-2 text-xs bg-amber-100 border border-amber-500 text-amber-900 p-2 font-bold rounded text-center">
                              Pembayaran cicilan sebesar Rp {Number(pelunasanAmount).toLocaleString("id-ID")}. Sisa hutang berikutnya menjadi: Rp {(selectedDebt.remainingDebt - Number(pelunasanAmount)).toLocaleString("id-ID")}.
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleProcessPelunasan}
                          disabled={loading || !pelunasanAmount || Number(pelunasanAmount) <= 0}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white p-4 font-bold text-base uppercase tracking-wider transition-all flex justify-center items-center gap-2 shadow-[4px_4px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                        >
                          {loading ? "MEMPROSES..." : "PROSES PEMBAYARAN PELUNASAN"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard Checkout Area (LUNAS or DP) */
                  <>
                    <div className="mb-4 space-y-3 border-b border-gray-300 pb-4">
                      <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-700 flex items-center justify-between">
                          <span>Tanggal & Waktu Transaksi</span>
                          <span className="text-[10px] text-blue-600 font-normal lowercase">*bisa diubah jika mencatat transaksi kemarin</span>
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full p-2.5 border border-black bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black transition-colors"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase mb-1 text-gray-700">Nama Customer (Opsional)</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                            placeholder="Mis: PAK BUDI"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase mb-1 text-gray-700">No. Telp (Opsional)</label>
                          <input
                            type="text"
                            className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Mis: 0812..."
                          />
                        </div>
                      </div>

                      {paymentMode === 'DP' && (
                        <div className="col-span-2 animate-fade-in mt-1">
                          <label className="block text-xs font-bold uppercase mb-1 text-amber-900">
                            Nominal DP Yang Dibayar Saat Ini (Rp):
                          </label>
                          <input
                            type="number"
                            className="w-full p-3 border-2 border-amber-600 bg-white font-mono text-xl font-bold focus:outline-none focus:ring-4 focus:ring-amber-200 transition-all"
                            value={dpAmount}
                            onChange={(e) => setDpAmount(e.target.value.replace(/^0+(?=\d)/, ''))}
                            placeholder="Ketik nominal uang muka (DP)..."
                          />
                          {Number(dpAmount) > 0 && cartTotal > 0 && (
                            <div className="text-xs text-red-600 font-bold mt-1">
                              Sisa Hutang Yang Belum Dibayar: Rp {Math.max(0, cartTotal - Number(dpAmount)).toLocaleString("id-ID")}
                            </div>
                          )}
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
                      {loading ? "PROCESSING..." : (paymentMode === 'DP' ? "SIMPAN TRANSAKSI DP" : "BAYAR / CHECKOUT")}
                    </button>
                  </>
                )}
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
                              {items[0]?.customer_name && items[0]?.customer_name !== '-' && (
                                <span className="bg-blue-600 text-white px-2 py-0.5 text-xs font-bold rounded">
                                  ?? {items[0].customer_name}
                                </span>
                              )}
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




















