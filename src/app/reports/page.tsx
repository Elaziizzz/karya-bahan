"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { 
  FileText, Clock, Download, Calendar, Trash2, TrendingUp, DollarSign, 
  Package, PiggyBank, Wallet, ArrowDownRight, ArrowUpRight, X, Search, 
  Printer, Edit2, User, Phone, CheckCircle2, AlertCircle 
} from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type Transaction = {
  id: string;
  material_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  cost_price: number;
  total_price: number;
  created_at: string;
  deleted_at: string | null;
  store: string;
  payment_status?: string;
  dp_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  materials?: { name: string; code?: string; };
};

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
};

function displayMaterialName(name: string | undefined): string {
  if (!name) return "-";
  return name.replace(/\s*=\s*\((.*?)\)$/, '').trim();
}

export default function ReportsPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStore] = useState("karya_bahan");
  
  // Filter state
  const [selectedFilter, setSelectedFilter] = useState<string>("TODAY");
  const [customDate, setCustomDate] = useState<string>("");
  const [customMonth, setCustomMonth] = useState<string>("");
  const [selectedInvestor, setSelectedInvestor] = useState<string>("Semua");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [initialBudget, setInitialBudget] = useState<number>(0);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState("");

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<{
    invoiceNo: string;
    date: Date;
    items: Array<{
      material: { name: string; code?: string };
      display_quantity: number;
      display_unit: string;
      display_price: number;
      subtotal: number;
    }>;
    total: number;
    customerName: string;
    customerPhone: string;
    paymentStatus: string;
    dpAmount: number;
  } | null>(null);

  // Edit Modal State
  const [editingNota, setEditingNota] = useState<{
    originalTimeKey: string;
    invoiceNo: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    payment_status: string;
    dp_amount: number;
    items: Array<{
      id: string;
      material_id: string;
      material_name: string;
      material_code?: string;
      quantity: number;
      original_quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchData("karya_bahan");
    const savedBudget = localStorage.getItem(`karyabahan_initial_budget_${activeStore}`);
    if (savedBudget) setInitialBudget(Number(savedBudget));
  }, []);

  function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(tempBudget);
    setInitialBudget(val);
    localStorage.setItem(`karyabahan_initial_budget_${activeStore}`, val.toString());
    setIsEditingBudget(false);
  }

  async function fetchData(store: string) {
    setLoading(true);
    // Fetch Transactions
    const { data: trx } = await supabase
      .from("transactions")
      .select("*, materials(name, code)")
      .eq("store", store)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    
    if (trx) setAllTransactions(trx as Transaction[]);

    // Fetch Materials for Asset Calculation
    const { data: mats } = await supabase
      .from("materials")
      .select("*")
      .eq("store", store)
      .is("deleted_at", null);
    
    if (mats) setMaterials(mats as Material[]);

    setLoading(false);
  }

  // Delete full nota (all items in the group)
  async function deleteFullNota(items: Transaction[]) {
    const isSingle = items.length === 1;
    const msg = isSingle 
      ? "Buang transaksi ini ke tong sampah? Stok barang akan dikembalikan otomatis."
      : `Buang nota ini (${items.length} jenis barang) ke tong sampah? Stok seluruh barang di nota ini akan dikembalikan otomatis.`;
    if (!confirm(msg)) return;
    
    setLoading(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      alert("Gagal menghapus nota: " + error.message);
    } else {
      ids.forEach(id => {
        try {
          fetch('/api/sheets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
          }).catch(console.error);
        } catch (e) { console.error(e); }
      });
      alert("Nota berhasil dihapus dan dibuang ke Tong Sampah. Stok barang sudah dikembalikan!");
    }
    await fetchData(activeStore);
    setLoading(false);
  }

  // Quick Lunaskan Nota
  async function lunasiNota(items: Transaction[]) {
    const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
    const dp = Number(items[0]?.dp_amount) || 0;
    const sisa = Math.max(0, totalNota - dp);
    if (!confirm(`Konfirmasi pelunasan sisa hutang sebesar Rp ${sisa.toLocaleString("id-ID")} untuk nota ini?`)) return;
    
    setLoading(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ payment_status: 'LUNAS', dp_amount: totalNota }).in("id", ids);
    
    if (error) {
      alert("Gagal memproses pelunasan: " + error.message);
    } else {
      const invoiceNo = `KB-${new Date(items[0]?.created_at || 0).getTime()}`;
      try {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lunas', payload: { invoiceNo, total: totalNota }, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      } catch (e) { console.error(e); }
      alert("Pelunasan berhasil diproses! Status nota menjadi LUNAS.");
    }
    await fetchData(activeStore);
    setLoading(false);
  }

  // Open Edit Nota Modal
  function openEditModal(g: any) {
    const formattedDate = format(new Date(g.created_at), "yyyy-MM-dd'T'HH:mm");
    setEditingNota({
      originalTimeKey: g.timeKey,
      invoiceNo: g.invoiceNo,
      created_at: formattedDate,
      customer_name: g.customer_name && g.customer_name !== '-' ? g.customer_name : '',
      customer_phone: g.customer_phone && g.customer_phone !== '-' ? g.customer_phone : '',
      payment_status: g.payment_status || 'LUNAS',
      dp_amount: Number(g.dp_amount) || 0,
      items: g.items.map((i: any) => ({
        id: i.id,
        material_id: i.material_id,
        material_name: displayMaterialName(i.materials?.name || "Barang"),
        material_code: i.materials?.code,
        quantity: i.quantity,
        original_quantity: i.quantity,
        unit_price: Math.round(i.total_price / (i.quantity || 1)),
        subtotal: i.total_price
      }))
    });
  }

  // Save Edit Nota directly
  async function handleSaveEdit() {
    if (!editingNota) return;
    setSavingEdit(true);

    try {
      const totalNota = editingNota.items.reduce((sum, item) => sum + item.subtotal, 0);
      const isDp = editingNota.payment_status === 'DP';
      const dpNum = isDp ? Number(editingNota.dp_amount || 0) : totalNota;
      const finalCreatedAt = new Date(editingNota.created_at).toISOString();

      // Check stock differences and update
      for (const item of editingNota.items) {
        const qtyDiff = item.quantity - item.original_quantity;
        if (qtyDiff !== 0) {
          const { data: mat, error: matErr } = await supabase
            .from("materials")
            .select("id, name, current_stock")
            .eq("id", item.material_id)
            .single();

          if (matErr || !mat) throw new Error("Gagal mengambil stok material: " + (matErr?.message || ""));
          
          if (qtyDiff > 0 && mat.current_stock < qtyDiff) {
            throw new Error(`Stok "${mat.name}" tidak mencukupi untuk penambahan ${qtyDiff} unit! (Tersedia: ${mat.current_stock})`);
          }

          const newStock = mat.current_stock - qtyDiff;
          const { error: updateMatErr } = await supabase
            .from("materials")
            .update({ current_stock: newStock })
            .eq("id", item.material_id);

          if (updateMatErr) throw new Error("Gagal update stok: " + updateMatErr.message);
        }

        const { error: txErr } = await supabase
          .from("transactions")
          .update({
            quantity: item.quantity,
            total_price: item.subtotal,
            customer_name: editingNota.customer_name.trim() || "-",
            customer_phone: editingNota.customer_phone.trim() || "-",
            payment_status: isDp ? "DP" : "LUNAS",
            dp_amount: dpNum,
            created_at: finalCreatedAt
          })
          .eq("id", item.id);

        if (txErr) throw new Error("Gagal update transaksi: " + txErr.message);
      }

      alert("Nota berhasil diperbarui!");
      setEditingNota(null);
      await fetchData(activeStore);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  // Transfer and edit in Cashier
  async function handleEditInCashier() {
    if (!editingNota) return;
    if (!confirm("Buka nota ini di Keranjang Kasir? Nota saat ini akan dihapus dari riwayat (stok dikembalikan otomatis) dan barang akan dimasukkan ke Keranjang Kasir untuk diedit.")) return;

    setSavingEdit(true);
    try {
      const ids = editingNota.items.map(i => i.id);
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw new Error("Gagal menyiapkan edit nota: " + error.message);

      const cartItems = editingNota.items.map(item => {
        const mat = materials.find(m => m.id === item.material_id) || {
          id: item.material_id,
          name: item.material_name,
          price: item.unit_price,
          cost_price: 0,
          store: activeStore,
          current_stock: 0
        };

        return {
          material: mat,
          quantity: item.quantity,
          display_quantity: item.quantity,
          display_unit: 'Pcs',
          display_price: item.unit_price,
          pack_multiplier: 1,
          subtotal: item.subtotal
        };
      });

      const editKey = activeStore === 'karya_bahan' ? 'karyabahan_edit_cart' : 'bysca_edit_cart';
      localStorage.setItem(editKey, JSON.stringify({
        cart: cartItems,
        customerName: editingNota.customer_name,
        customerPhone: editingNota.customer_phone,
        paymentStatus: editingNota.payment_status,
        dpAmount: editingNota.dp_amount,
        transactionDate: editingNota.created_at
      }));

      window.location.href = "/";
    } catch (e: any) {
      alert("Error: " + e.message);
      setSavingEdit(false);
    }
  }

  // Print Nota modal trigger
  function printNotaStruk(g: any) {
    const invoiceNo = g.invoiceNo || `KB-${new Date(g.created_at).getTime()}`;
    const items = g.items || [];
    const isDp = g.payment_status === 'DP';
    const dpNum = isDp ? (Number(g.dp_amount) || 0) : g.total_price;

    setReceiptData({
      invoiceNo,
      date: new Date(g.created_at),
      items: items.map((t: any) => {
        let display_quantity = t.quantity;
        let display_unit = 'Pcs';
        let display_price = Math.round(t.total_price / (t.quantity || 1));

        const packMatch = t.materials?.name?.match(/-\s*\[1\s+([^=]+?)\s*=\s*(\d+)\s+([^@\]]+?)(?:\s*@\s*(\d+))?\](?:\s*=\s*\((.*?)\))?$/);
        if (packMatch) {
          const packName = packMatch[1].trim();
          const packMult = Number(packMatch[2]);
          if (t.quantity % packMult === 0 && t.quantity >= packMult) {
            display_quantity = t.quantity / packMult;
            display_unit = packName;
          } else {
            display_unit = packMatch[3].trim();
          }
        } else {
          const baseMatch = t.materials?.name?.match(/-\s*\[([^=\]]+?)\](?:\s*=\s*\((.*?)\))?$/);
          if (baseMatch) {
            display_unit = baseMatch[1].trim();
          }
        }

        return {
          material: {
            name: t.materials?.name || "-",
            code: t.materials?.code
          },
          display_quantity,
          display_unit,
          display_price,
          subtotal: t.total_price
        };
      }),
      total: g.total_price,
      customerName: g.customer_name || "-",
      customerPhone: g.customer_phone || "-",
      paymentStatus: g.payment_status || "LUNAS",
      dpAmount: dpNum
    });
  }

  // Filtered transactions
  const investors = useMemo(() => {
    const list = new Set<string>();
    allTransactions.forEach((t: any) => {
      const im = t.materials?.name?.match(/\s*=\s*\((.*?)\)$/);
      if (im) list.add(im[1].trim());
    });
    return Array.from(list).sort();
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    const today = new Date();
    let result = allTransactions;

    if (selectedFilter === "TODAY") {
      result = allTransactions.filter((t: any) => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"));
    } else if (selectedFilter === "YESTERDAY") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      result = allTransactions.filter((t: any) => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"));
    } else if (selectedFilter === "THIS_MONTH") {
      result = allTransactions.filter((t: any) => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === format(today, "yyyy-MM"));
    } else if (selectedFilter === "CUSTOM_DATE" && customDate) {
      result = allTransactions.filter((t: any) => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === customDate);
    } else if (selectedFilter === "CUSTOM_MONTH" && customMonth) {
      result = allTransactions.filter((t: any) => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === customMonth);
    }

    if (selectedInvestor !== "Semua") {
      result = result.filter((t: any) => {
        const im = t.materials?.name?.match(/\s*=\s*\((.*?)\)$/);
        return im && im[1].trim() === selectedInvestor;
      });
    }

    // Filter by Payment Status
    if (statusFilter === "DP") {
      result = result.filter((t: any) => t.type === "OUT" && t.payment_status === "DP");
    } else if (statusFilter === "LUNAS") {
      result = result.filter((t: any) => t.type === "OUT" && t.payment_status !== "DP");
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t: any) => {
        const custName = (t.customer_name || "").toLowerCase();
        const custPhone = (t.customer_phone || "").toLowerCase();
        const matName = (t.materials?.name || "").toLowerCase();
        const matCode = (t.materials?.code || "").toLowerCase();
        const invoiceNo = `kb-${new Date(t.created_at || 0).getTime()}`;
        return custName.includes(q) || custPhone.includes(q) || matName.includes(q) || matCode.includes(q) || invoiceNo.includes(q);
      });
    }

    return result;
  }, [allTransactions, selectedFilter, customDate, customMonth, selectedInvestor, statusFilter, searchQuery]);

  // Group logic for UI and Exports
  const groupedTransactions = useMemo(() => {
    const groups: any[] = [];

    // filteredTransactions is sorted by created_at descending
    filteredTransactions.forEach((t: any) => {
      const timeKey = t.created_at; // Exact timestamp
      
      let nota = groups.find(g => g.timeKey === timeKey && g.type === t.type);
      if (!nota) {
        nota = {
          timeKey,
          invoiceNo: `KB-${new Date(timeKey).getTime()}`,
          created_at: t.created_at,
          type: t.type,
          customer_name: t.customer_name && t.customer_name !== '-' ? t.customer_name : 'Tanpa Nama',
          customer_phone: t.customer_phone || '-',
          payment_status: t.payment_status || 'LUNAS',
          dp_amount: Number(t.dp_amount) || 0,
          items: [],
          total_price: 0,
          cost_price: 0,
          quantity: 0
        };
        groups.push(nota);
      }
      
      nota.items.push(t);
      nota.total_price += Number(t.total_price);
      nota.cost_price += Number(t.cost_price || 0) * t.quantity;
      nota.quantity += t.quantity;
    });
    
    return groups;
  }, [filteredTransactions]);

  const outTransactions = filteredTransactions.filter((t: any) => t.type === 'OUT');
  const inTransactions = filteredTransactions.filter((t: any) => t.type === 'IN');

  const totalSalesRevenue = outTransactions.reduce((sum, t) => sum + Number(t.total_price), 0);
  const totalPurchaseCost = inTransactions.reduce((sum, t) => sum + Number(t.total_price), 0);
  
  // COGS (Cost of Goods Sold / Modal Terjual) = sum of (qty * cost_price) for all OUT transactions
  const costRecovered = outTransactions.reduce((sum, t) => sum + (t.quantity * (t.cost_price || 0)), 0);
  
  // Realized Profit = Revenue - COGS
  const realizedProfit = totalSalesRevenue - costRecovered;

  // Unsold Assets (Sisa Nilai Stok) = sum of (current_stock * cost_price)
  const totalAssetValue = materials.reduce((sum, m) => sum + (m.current_stock * (m.cost_price || 0)), 0);

  // Potential Profit = sum of (current_stock * (price - cost_price))
  const potentialProfit = materials.reduce((sum, m) => sum + (m.current_stock * (m.price - (m.cost_price || 0))), 0);

  const netBalance = totalSalesRevenue - totalPurchaseCost;
  const currentBudget = initialBudget + netBalance;

  // Total Piutang (Customer Debt yet to be paid)
  const totalPiutang = useMemo(() => {
    const groups: Record<string, { total: number; dp: number; status?: string }> = {};
    outTransactions.forEach((t: any) => {
      const key = t.created_at;
      if (!groups[key]) {
        groups[key] = {
          total: 0,
          dp: Number(t.dp_amount) || 0,
          status: t.payment_status
        };
      }
      groups[key].total += Number(t.total_price || 0);
    });

    return Object.values(groups)
      .filter(g => g.status === 'DP')
      .reduce((sum, g) => sum + Math.max(0, g.total - g.dp), 0);
  }, [outTransactions]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`${"Karya Bahan".toUpperCase()} - P&L Report`, 14, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    let filterLabel = selectedFilter;
    if (selectedFilter === "TODAY") filterLabel = "Hari Ini";
    else if (selectedFilter === "YESTERDAY") filterLabel = "Kemarin";
    else if (selectedFilter === "THIS_MONTH") filterLabel = "Bulan Ini";
    else if (selectedFilter === "CUSTOM_DATE") filterLabel = customDate ? format(new Date(customDate), "dd MMMM yyyy") : "Tanggal Spesifik";
    else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth ? format(new Date(customMonth + "-01"), "MMMM yyyy") : "Bulan Spesifik";
    else if (selectedFilter === "ALL") filterLabel = "Semua Waktu";

    doc.text(`Periode: ${filterLabel}`, 14, 30);
    doc.text(`Dicetak pada: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 14, 35);

    const tableColumn = ["Tanggal", "Tipe", "Customer", "Material", "Qty", "H. Modal/Pcs", "H. Jual/Pcs", "Total (Rp)", "Profit (Rp)"];
    const tableRows: any[] = [];

    filteredTransactions.forEach((t: any) => {
      const typeStr = t.type === 'IN' ? 'BELI (IN)' : 'JUAL (OUT)';
      const priceStr = (t.type === 'IN' ? '-' : '+') + t.total_price.toLocaleString("id-ID");
      const profit = t.type === 'OUT' ? (t.total_price - (t.quantity * (t.cost_price || 0))) : 0;
      const profitStr = t.type === 'OUT' ? `+${profit.toLocaleString("id-ID")}` : '-';
      
      const modalPcsStr = t.type === 'IN' ? (t.total_price / (t.quantity || 1)).toLocaleString("id-ID") : (t.cost_price || 0).toLocaleString("id-ID");
      const jualPcsStr = t.type === 'OUT' ? (t.total_price / (t.quantity || 1)).toLocaleString("id-ID") : '-';

      const rowData = [
        format((t.created_at ? new Date(t.created_at) : new Date(0)), "dd MMM yyyy HH:mm"),
        typeStr,
        t.customer_name && t.customer_name !== '-' ? t.customer_name : '-',
        (t.materials?.code ? `"${t.materials.name} [${t.materials.code}]"` : (t.materials?.name || "Unknown")),
        t.quantity.toString(),
        modalPcsStr,
        jualPcsStr,
        priceStr,
        profitStr
      ];
      tableRows.push(rowData);
    });

    tableRows.push(["", "", "", "", "", "", "", "", ""]);
    tableRows.push(["", "", "", "", "", "", "TOTAL PENJUALAN:", `+${totalSalesRevenue.toLocaleString("id-ID")}`, ""]);
    tableRows.push(["", "", "", "", "", "", "MODAL KELUAR:", `-${costRecovered.toLocaleString("id-ID")}`, ""]);
    tableRows.push(["", "", "", "", "", "", "PROFIT BERSIH:", "", `+${realizedProfit.toLocaleString("id-ID")}`]);
    tableRows.push(["", "", "", "", "", "", "TOTAL PEMBELIAN:", `-${totalPurchaseCost.toLocaleString("id-ID")}`, ""]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, font: 'helvetica' },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' }
      }
    });

    doc.save(`Laporan_${"Karya Bahan"}_${filterLabel.replace(/\s+/g, '_')}.pdf`);
  };

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Laporan Laba Rugi");

      const mapGroups: { [key: string]: any[] } = {};
      filteredTransactions.forEach(t => {
        const key = t.created_at || "unknown";
        if (!mapGroups[key]) mapGroups[key] = [];
        mapGroups[key].push(t);
      });
      const transactionsGrouped = Object.values(mapGroups);

      sheet.columns = [
        { key: 'no', width: 6 },
        { key: 'date', width: 22 },
        { key: 'type', width: 14 },
        { key: 'customer', width: 20 },
        { key: 'material', width: 32 },
        { key: 'qty', width: 8 },
        { key: 'modal', width: 16 },
        { key: 'jual', width: 16 },
        { key: 'total', width: 18 },
        { key: 'profit', width: 16 }
      ];

      const titleRow = sheet.addRow(["LAPORAN KEUANGAN & LABA RUGI - " + "Karya Bahan".toUpperCase()]);
      titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: "FF000000" } };
      sheet.mergeCells('A1:J1');
      sheet.addRow([]);

      const addBorders = (row: any) => {
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          if (!cell.border) {
            cell.border = {
              top: {style:'thin', color: {argb:'FF000000'}},
              left: {style:'thin', color: {argb:'FF000000'}},
              bottom: {style:'thin', color: {argb:'FF000000'}},
              right: {style:'thin', color: {argb:'FF000000'}}
            };
          }
        });
      };

      const headerRow = sheet.addRow({
        no: "NO", date: "TANGGAL", type: "TIPE", customer: "CUSTOMER", material: "NAMA BARANG", qty: "QTY", modal: "HARGA MODAL", jual: "HARGA JUAL", total: "TOTAL TRANSAKSI", profit: "PROFIT/RUGI"
      });
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0070C0" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      addBorders(headerRow);

      let totalRevenue = 0;
      let totalExpense = 0;
      let totalNetProfit = 0;
      
      transactionsGrouped.forEach((group, idx) => {
        const timeStr = format(new Date(group[0].created_at), "dd MMM yyyy HH:mm");
        const typeStr = group[0].type === "IN" ? "Restock Masuk" : "Kasir Keluar";
        let notaTotal = 0;
        let notaProfit = 0;
        const isOutGroup = group[0].type === "OUT";
        const custName = group[0].customer_name && group[0].customer_name !== '-' ? group[0].customer_name : '-';

        group.forEach((item, itemIdx) => {
          const isOut = item.type === "OUT";
          const itemTotal = item.total_price || 0;
          const itemModal = item.cost_price * item.quantity;
          const profit = isOut ? (itemTotal - itemModal) : 0;
          
          if (isOut) {
            totalRevenue += itemTotal;
            totalNetProfit += profit;
          } else {
            totalExpense += itemTotal;
          }
          
          notaTotal += itemTotal;
          notaProfit += profit;

          const row = sheet.addRow({
            no: itemIdx === 0 ? (idx + 1) : "",
            date: itemIdx === 0 ? timeStr : "",
            type: itemIdx === 0 ? typeStr : "",
            customer: itemIdx === 0 ? custName : "",
            material: item.materials?.name || "-",
            qty: item.quantity,
            modal: item.cost_price,
            jual: isOut ? (itemTotal / item.quantity) : "-",
            total: itemTotal,
            profit: isOut ? profit : "-"
          });
          
          addBorders(row);
          if (itemIdx === 0) {
            const typeCell = row.getCell('type');
            typeCell.font = { bold: true, color: { argb: isOut ? "FF047857" : "FFB91C1C" } };
            typeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isOut ? "FFD1FAE5" : "FFFEE2E2" } };
            typeCell.alignment = { horizontal: "center" };
          }
          
          row.getCell('material').alignment = { wrapText: true };

          row.getCell(7).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(8).numFmt = '"Rp" #,##0';
          row.getCell(9).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(10).numFmt = '"Rp" #,##0';
        });

        const subRow = sheet.addRow({
           no: "", date: "", type: "", customer: "", material: "SUBTOTAL NOTA:", qty: "", modal: "", jual: "", total: notaTotal, profit: isOutGroup ? notaProfit : "-"
        });
        subRow.font = { bold: true, color: { argb: "FF374151" } };
        subRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } };
        addBorders(subRow);
        
        subRow.getCell(9).numFmt = '"Rp" #,##0';
        if(isOutGroup) subRow.getCell(10).numFmt = '"Rp" #,##0';
        
        sheet.addRow({});
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Laporan_Laba_Rugi_${"Karya Bahan"}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err: any) {
      console.error(err);
      alert("Gagal mendownload Excel: " + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in print:p-0 print:m-0 print:space-y-0 print:max-w-none">
      
      {/* Receipt Modal (Only visible when receiptData exists) */}
      {receiptData && (() => {
        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.max(1, Math.ceil((receiptData.items?.length || 0) / ITEMS_PER_PAGE));
        return (
          <div className="receipt-modal-root fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/60 overflow-y-auto p-2 sm:p-4 print:p-0 print:static print:bg-white print:z-auto print:block print:w-[180mm] print:mx-auto print:overflow-visible">
            <div className="relative max-w-3xl w-full mx-auto my-auto print:my-0 print:max-w-none print:w-[180mm] print:mx-auto">
              <div className="flex justify-end gap-2 mb-2 print:hidden sticky top-0 z-10">
                <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded transition-colors flex items-center gap-2 font-bold shadow-lg" title="Cetak">
                  <Printer className="w-5 h-5" />
                  Cetak Struk
                </button>
                <button onClick={() => setReceiptData(null)} className="p-2 bg-gray-200 hover:bg-red-500 hover:text-white rounded transition-colors shadow-lg" title="Tutup">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const pageItems = receiptData.items.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);
                const isLastPage = pageIdx === totalPages - 1;
                return (
                  <div
                    key={pageIdx}
                    translate="no"
                    className={`notranslate receipt-page bg-white p-4 sm:p-5 pt-5 shadow-2xl relative print:shadow-none print:p-0 print:pt-0.5 print:pb-0.5 print:max-w-none print:w-[180mm] print:mx-auto text-black font-mono print:font-mono w-full max-w-[180mm] mx-auto text-[13px] leading-tight flex flex-col justify-between min-h-[96mm] print:min-h-[96mm] print:h-auto mb-3 print:mb-0 box-border ${!isLastPage ? "receipt-page-break print:break-after-page" : ""}`}
                  >
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
                                {displayMaterialName(item.material.name).replace(/-\s*\[.*?\]$/, '').trim()}
                                {item.material.code ? ` [${item.material.code}]` : ''}
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
                        {/* Left: Message & Tanda Terima */}
                        <div className="flex-1 max-w-[85mm] flex flex-col justify-between self-stretch pr-2 text-left">
                          <div className="mb-1.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-black leading-tight">
                              TERIMA KASIH<br />ATAS KUNJUNGAN ANDA.
                            </div>
                            <div className="text-[10.5px] font-bold uppercase tracking-tight text-black mt-0.5 leading-tight font-sans">
                              BARANG YANG SUDAH DIBELI<br />TIDAK DAPAT DITUKAR/DIKEMBALIKAN
                            </div>
                          </div>
                          <div className="mt-auto pt-1">
                            <p className="font-medium text-[12px]">Tanda Terima,</p>
                            <p className="whitespace-nowrap font-mono tracking-tighter text-[12.5px] select-none mt-5">(....................)</p>
                          </div>
                        </div>

                        {/* Center: Hormat Kami */}
                        <div className="text-center w-32 flex flex-col justify-end self-stretch pb-0.5">
                          <p className="font-medium text-[12px]">Hormat Kami,</p>
                          <p className="whitespace-nowrap font-mono tracking-tighter text-[12.5px] select-none mt-5">(....................)</p>
                        </div>

                        {/* Right: Total Calculation */}
                        <div className="w-56 text-right text-[13px] leading-snug pl-2 border-l border-gray-200 print:border-black/20">
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
                                <span>Uang Muka / DP:</span>
                                <span>Rp {receiptData.dpAmount.toLocaleString("id-ID")}</span>
                              </div>
                              <div className="flex justify-between py-0.5 font-bold text-[12px] text-red-600 print:text-black mt-0.5">
                                <span>SISA KURANG:</span>
                                <span>Rp {Math.max(0, receiptData.total - receiptData.dpAmount).toLocaleString("id-ID")}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Edit Nota Modal */}
      {editingNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white border-2 border-black max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fade-in my-8">
            <div className="flex justify-between items-center border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-600" />
                  EDIT NOTA TRANSAKSI
                </h3>
                <span className="text-xs font-mono text-gray-500">No. Faktur: {editingNota.invoiceNo}</span>
              </div>
              <button 
                onClick={() => setEditingNota(null)}
                className="text-gray-400 hover:text-black p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Info Waktu & Customer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">Waktu Transaksi</label>
                <input 
                  type="datetime-local"
                  className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  value={editingNota.created_at}
                  onChange={(e) => setEditingNota({ ...editingNota, created_at: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">Nama Customer</label>
                <input 
                  type="text"
                  placeholder="Mis: PAK BUDI"
                  className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  value={editingNota.customer_name}
                  onChange={(e) => setEditingNota({ ...editingNota, customer_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">No. Telp</label>
                <input 
                  type="text"
                  placeholder="Mis: 0812..."
                  className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  value={editingNota.customer_phone}
                  onChange={(e) => setEditingNota({ ...editingNota, customer_phone: e.target.value })}
                />
              </div>
            </div>

            {/* Status Pembayaran */}
            <div className="bg-gray-50 p-3 border border-gray-300 space-y-2">
              <label className="block text-xs font-bold uppercase text-gray-700">Status Pembayaran</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                  <input 
                    type="radio" 
                    name="edit_status" 
                    value="LUNAS" 
                    checked={editingNota.payment_status === 'LUNAS'}
                    onChange={() => setEditingNota({ ...editingNota, payment_status: 'LUNAS' })}
                  />
                  <span>BAYAR LUNAS</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                  <input 
                    type="radio" 
                    name="edit_status" 
                    value="DP" 
                    checked={editingNota.payment_status === 'DP'}
                    onChange={() => setEditingNota({ ...editingNota, payment_status: 'DP' })}
                  />
                  <span className="text-amber-700">BAYAR DP / HUTANG</span>
                </label>
              </div>

              {editingNota.payment_status === 'DP' && (
                <div className="pt-2 flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 whitespace-nowrap">Nominal DP (Rp):</label>
                  <input 
                    type="number"
                    className="border border-black p-1.5 text-xs font-mono font-bold w-40 bg-white"
                    value={editingNota.dp_amount}
                    onChange={(e) => setEditingNota({ ...editingNota, dp_amount: Number(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-red-600 font-bold ml-auto">
                    Sisa Hutang: Rp {Math.max(0, editingNota.items.reduce((sum, i) => sum + i.subtotal, 0) - editingNota.dp_amount).toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-2">Daftar Barang Di Nota</label>
              <div className="border border-black overflow-x-auto max-h-60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-black text-white">
                    <tr>
                      <th className="p-2">Barang</th>
                      <th className="p-2 text-right w-20">Qty</th>
                      <th className="p-2 text-right w-28">Harga (Rp)</th>
                      <th className="p-2 text-right w-32">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {editingNota.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-2 font-semibold">
                          {item.material_name} {item.material_code && `[${item.material_code}]`}
                        </td>
                        <td className="p-2 text-right">
                          <input 
                            type="number" 
                            min="1" 
                            className="w-16 border border-gray-400 p-1 text-right font-mono font-bold"
                            value={item.quantity}
                            onChange={(e) => {
                              const newQty = Math.max(1, parseInt(e.target.value) || 1);
                              const newItems = [...editingNota.items];
                              newItems[idx].quantity = newQty;
                              newItems[idx].subtotal = newQty * newItems[idx].unit_price;
                              setEditingNota({ ...editingNota, items: newItems });
                            }}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input 
                            type="number" 
                            min="0" 
                            className="w-24 border border-gray-400 p-1 text-right font-mono"
                            value={item.unit_price}
                            onChange={(e) => {
                              const newPrice = Math.max(0, parseInt(e.target.value) || 0);
                              const newItems = [...editingNota.items];
                              newItems[idx].unit_price = newPrice;
                              newItems[idx].subtotal = newItems[idx].quantity * newPrice;
                              setEditingNota({ ...editingNota, items: newItems });
                            }}
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          Rp {item.subtotal.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-2 font-bold text-sm bg-gray-100 p-2 border border-gray-300">
                <span>TOTAL NOTA:</span>
                <span className="font-mono text-green-700 text-base">
                  Rp {editingNota.items.reduce((sum, i) => sum + i.subtotal, 0).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-gray-300 flex flex-wrap gap-2 justify-between items-center">
              <button
                type="button"
                onClick={handleEditInCashier}
                disabled={savingEdit}
                className="bg-gray-100 hover:bg-gray-200 text-black border border-black px-3 py-2 text-xs font-bold rounded transition-colors"
                title="Pindah seluruh barang ke keranjang kasir untuk diedit ulang"
              >
                🛒 Pindah & Edit di Kasir
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNota(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 border border-gray-300 text-xs font-bold rounded hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="bg-black text-white px-5 py-2 text-xs font-bold rounded hover:bg-gray-800 transition-colors flex items-center gap-1.5 shadow-md disabled:bg-gray-400"
                >
                  {savingEdit ? "Menyimpan..." : "💾 Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-8 h-8" />
            LAPORAN KEUANGAN & LABA RUGI
          </h1>
          <p className="text-gray-600 mt-1">Riwayat transaksi, perputaran modal, dan keuntungan bersih.</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex gap-2">
          <button 
            onClick={exportPDF}
            className="border border-black px-4 py-2 bg-white font-bold text-xs uppercase hover:bg-black hover:text-white transition-swiss active-press flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button 
            onClick={exportExcel}
            className="border border-black px-4 py-2 bg-black text-white font-bold text-xs uppercase hover:bg-gray-800 transition-swiss active-press flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Filter Section M-Banking Style */}
      <div className="bg-gray-100 p-4 border border-black flex flex-wrap items-center gap-4 transition-swiss hover:shadow-sm">
        <Calendar className="w-6 h-6 text-gray-500" />
        <div className="flex-1">
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih e-Statement (Periode)</label>
              <select 
                value={selectedFilter}
                onChange={(e) => {
                  setSelectedFilter(e.target.value);
                  if (e.target.value === "CUSTOM_DATE" && !customDate) setCustomDate(format(new Date(), "yyyy-MM-dd"));
                  if (e.target.value === "CUSTOM_MONTH" && !customMonth) setCustomMonth(format(new Date(), "yyyy-MM"));
                }}
                className="bg-transparent font-bold text-lg border-b-2 border-black focus:outline-none focus:border-blue-600 pb-1 cursor-pointer transition-swiss"
              >
                <option value="TODAY">Hari Ini</option>
                <option value="YESTERDAY">Kemarin</option>
                <option value="THIS_MONTH">Bulan Ini</option>
                <option value="ALL">Semua Waktu / Seluruh Waktu</option>
                <option value="CUSTOM_DATE">Tanggal Spesifik...</option>
                <option value="CUSTOM_MONTH">Bulan Spesifik...</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih Investor</label>
              <select 
                value={selectedInvestor}
                onChange={(e) => setSelectedInvestor(e.target.value)}
                className="bg-transparent font-bold text-lg border-b-2 border-black focus:outline-none focus:border-blue-600 pb-1 cursor-pointer transition-swiss"
              >
                <option value="Semua">Semua Investor</option>
                {investors.map(inv => (
                  <option key={inv} value={inv}>{inv}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status Pembayaran</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent font-bold text-lg border-b-2 border-black focus:outline-none focus:border-blue-600 pb-1 cursor-pointer transition-swiss"
              >
                <option value="ALL">Semua Status</option>
                <option value="DP">Hutang / Belum Lunas (DP)</option>
                <option value="LUNAS">Lunas</option>
              </select>
            </div>

            {/* Pencarian Customer / No Nota / Barang */}
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Cari Customer / No. Nota / Barang</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Ketik nama customer, no nota, barang..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-sm font-bold border-b-2 border-black bg-white focus:outline-none focus:border-blue-600"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {selectedFilter === "CUSTOM_DATE" && (
          <div className="animate-fade-in">
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih Tanggal</label>
            <input 
              type="date"
              className="bg-white border border-black px-3 py-2 text-sm font-bold focus-ring transition-swiss"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          </div>
        )}
        {selectedFilter === "CUSTOM_MONTH" && (
          <div className="animate-fade-in">
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih Bulan</label>
            <input 
              type="month"
              className="bg-white border border-black px-3 py-2 text-sm font-bold focus-ring transition-swiss"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div>
        <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          FINANCIAL SUMMARY
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border-2 border-black p-5 bg-white hover-elevate transition-swiss group shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl">
            <div className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-2 group-hover:text-black transition-colors">
              <Clock className="w-4 h-4 text-amber-600" />
              Sisa Piutang (Hutang Customer)
            </div>
            <div className="text-2xl font-mono font-bold text-amber-700">
              Rp <AnimatedNumber value={totalPiutang} />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 uppercase">Total tagihan DP yang belum dilunasi</div>
          </div>
          <div className="border-2 border-black p-6 bg-white hover-elevate transition-swiss group shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl">
            <div className="text-sm font-bold uppercase text-gray-500 mb-2 flex items-center gap-2 group-hover:text-black transition-colors">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
              Total Penjualan (Revenue)
            </div>
            <div className="text-3xl font-mono font-bold text-green-700">
              Rp <AnimatedNumber value={totalSalesRevenue} />
            </div>
          </div>
          <div className="border-2 border-black p-6 bg-white hover-elevate transition-swiss group shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl">
            <div className="text-sm font-bold uppercase text-gray-500 mb-2 flex items-center gap-2 group-hover:text-black transition-colors">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
              Total Pembelian (Expense)
            </div>
            <div className="text-3xl font-mono font-bold text-red-700">
              Rp <AnimatedNumber value={totalPurchaseCost} />
            </div>
          </div>
          <div className="border-2 border-black p-6 bg-black text-white hover-elevate transition-swiss group shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-bold uppercase text-gray-400">
                Sisa Saldo Kas (Budget)
              </div>
              <button 
                onClick={() => { setIsEditingBudget(true); setTempBudget(initialBudget.toString()); }}
                className="text-[10px] border border-gray-600 px-2 py-0.5 rounded hover:bg-white hover:text-black transition-colors"
              >
                Set Modal Awal
              </button>
            </div>
            {isEditingBudget ? (
              <form onSubmit={saveBudget} className="flex gap-2 items-center">
                <input 
                  type="number"
                  className="w-full bg-gray-900 border border-gray-600 text-white p-1 text-sm font-mono"
                  value={tempBudget}
                  onChange={(e) => setTempBudget(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="bg-white text-black text-xs px-2 py-1 font-bold">Simpan</button>
                <button type="button" onClick={() => setIsEditingBudget(false)} className="text-gray-400 text-xs">Batal</button>
              </form>
            ) : (
              <div>
                <div className="text-3xl font-mono font-bold text-white">
                  Rp <AnimatedNumber value={currentBudget} />
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  (Modal: Rp {initialBudget.toLocaleString("id-ID")} + Profit: Rp {netBalance.toLocaleString("id-ID")})
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid 4 Cards (Bottom Summary) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Modal Keluar */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 hover-elevate transition-swiss shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-lg">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Modal Keluar
          </div>
          <div className="text-2xl font-black text-blue-900">
            Rp {costRecovered.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Uang modal yang sudah balik dari hasil jualan</div>
        </div>
        
        {/* Card 2: Keuntungan Bersih */}
        <div className="border border-black p-4 bg-black text-white relative overflow-hidden group hover-elevate transition-swiss shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-lg">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400 group-hover:animate-bounce" />
            Keuntungan Bersih
          </div>
          <div className="text-2xl font-black text-green-400">
            +Rp {realizedProfit.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Profit murni yang masuk kantong (Omzet - Modal)</div>
        </div>

        {/* Card 3: Nilai Stok Mengendap */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 hover-elevate transition-swiss shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-lg">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2 group-hover:text-purple-600 transition-colors">
            <Package className="w-4 h-4 text-purple-600" />
            Sisa Nilai Stok (Aset)
          </div>
          <div className="text-2xl font-black text-purple-800">
            Rp {totalAssetValue.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Total uang modal Anda yang nyangkut di barang</div>
        </div>

        {/* Card 4: Potensi Keuntungan */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 hover-elevate transition-swiss shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-lg">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2 group-hover:text-yellow-600 transition-colors">
            <PiggyBank className="w-4 h-4 text-yellow-600" />
            Potensi Keuntungan
          </div>
          <div className="text-2xl font-black text-yellow-600">
            +Rp {potentialProfit.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Bila semua sisa stok saat ini laku terjual</div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-black text-white uppercase tracking-wide text-xs">
                <th className="p-4 font-bold">Tanggal</th>
                <th className="p-4 font-bold">Tipe & Status</th>
                <th className="p-4 font-bold">Customer</th>
                <th className="p-4 font-bold">Rincian Barang</th>
                <th className="p-4 font-bold text-center">Total Qty</th>
                <th className="p-4 font-bold text-right">Total Modal (Rp)</th>
                <th className="p-4 font-bold text-right">Total Transaksi (Rp)</th>
                <th className="p-4 font-bold text-right">Profit (Rp)</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {groupedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500 italic">
                    {searchQuery ? "Tidak ada transaksi yang cocok dengan pencarian." : "Tidak ada transaksi di periode ini."}
                  </td>
                </tr>
              ) : (
                groupedTransactions.map((g, idx) => {
                  const isOut = g.type === 'OUT';
                  const profit = isOut ? (g.total_price - g.cost_price) : 0;
                  const isDp = isOut && g.payment_status === 'DP';
                  const sisaHutang = Math.max(0, g.total_price - (g.dp_amount || 0));
                  const materialText = g.items.map((i: any) => `${i.quantity}x ${displayMaterialName(i.materials?.name) || 'Barang'}${i.materials?.code ? ` [${i.materials.code}]` : ''}`).join(', ');
                  
                  return (
                    <tr key={g.timeKey + g.type} className={`border-b-2 border-gray-300 transition-colors ${isOut ? 'bg-blue-50/30 hover:bg-blue-50' : 'bg-red-50/30 hover:bg-red-50'}`}>
                      <td className={`p-4 font-bold ${isOut ? 'text-blue-900' : 'text-red-900'}`}>
                        {format(new Date(g.created_at), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${isOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isOut ? 'NOTA (OUT)' : 'RESTOCK (IN)'}
                          </span>
                          {isOut && (
                            isDp ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-300">
                                BELUM LUNAS (Sisa: Rp {sisaHutang.toLocaleString("id-ID")})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-50 text-green-800 border border-green-200">
                                LUNAS
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {isOut ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-gray-500" />
                              {g.customer_name}
                            </span>
                            {g.customer_phone && g.customer_phone !== '-' && (
                              <span className="text-xs text-gray-500 font-mono ml-4">{g.customer_phone}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-mono">- (Restock)</span>
                        )}
                      </td>
                      <td className="p-4 font-medium text-gray-800 whitespace-normal min-w-[200px]">
                        {materialText}
                      </td>
                      <td className="p-4 text-center font-mono font-bold">{g.quantity}</td>
                      <td className="p-4 text-right font-mono text-gray-600">{g.cost_price.toLocaleString("id-ID")}</td>
                      <td className="p-4 text-right font-mono text-gray-600">{g.total_price.toLocaleString("id-ID")}</td>
                      <td className={`p-4 text-right font-mono font-black ${isOut ? 'text-blue-600' : 'text-gray-400'}`}>
                        {isOut ? '+' + profit.toLocaleString("id-ID") : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {isOut && (
                            <button
                              onClick={() => printNotaStruk(g)}
                              className="px-2.5 py-1 bg-gray-800 hover:bg-black text-white rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                              title="Cetak Ulang Struk Nota Ini"
                            >
                              <Printer className="w-3.5 h-3.5" /> Cetak
                            </button>
                          )}
                          {isDp && (
                            <button
                              onClick={() => lunasiNota(g.items)}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition-colors border border-green-800 shadow-sm"
                              title="Lunaskan Sisa Hutang Nota Ini"
                            >
                              Lunaskan
                            </button>
                          )}
                          {isOut && (
                            <button
                              onClick={() => openEditModal(g)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors border border-blue-800 shadow-sm flex items-center gap-1"
                              title="Edit Nota (Harga/Jumlah/Customer/Tanggal/Status)"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}
                          <button
                            onClick={() => deleteFullNota(g.items)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors border border-red-800 shadow-sm flex items-center gap-1"
                            title="Hapus / Buang Nota ke Tong Sampah (Kembalikan Stok)"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </div>
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
