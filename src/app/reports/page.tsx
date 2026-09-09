"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { FileText, Download, Calendar, Trash2, TrendingUp, DollarSign, Package, PiggyBank, Wallet, ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Removed getCookie

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
  materials?: { name: string; code?: string; };
};

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
};

export default function ReportsPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStore] = useState("karya_bahan");
  
  // Filter state
  const [selectedFilter, setSelectedFilter] = useState<string>("TODAY");
  const [customDate, setCustomDate] = useState<string>("");
  const [customMonth, setCustomMonth] = useState<string>("");

  const [initialBudget, setInitialBudget] = useState<number>(0);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState("");

  useEffect(() => {
    fetchData("karya_bahan");
    const savedBudget = localStorage.getItem(`karyabahan_initial_budget_karya_bahan`);
    if (savedBudget) setInitialBudget(Number(savedBudget));
  }, []);

  function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(tempBudget);
    setInitialBudget(val);
    localStorage.setItem(`karyabahan_initial_budget_karya_bahan`, val.toString());
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
      .eq("store", store);
    
    if (mats) setMaterials(mats as Material[]);

    setLoading(false);
  }

  // Soft delete from report page
  async function softDeleteTransaction(id: string) {
    if (!confirm("Buang transaksi ini ke tong sampah?")) return;
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
      
    if (error) {
      alert("Error menghapus transaksi: " + error.message);
    } else {
      fetchData(activeStore);
      try {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      } catch (e) { console.error(e); }
    }
  }

  // Filtered transactions
  const investors = useMemo(() => {
    const list = new Set<string>();
    allTransactions.forEach(t => {
      const im = t.materials?.name?.match(/\s*=\s*\((.*?)\)$/);
      if (im) list.add(im[1].trim());
    });
    return Array.from(list).sort();
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    const today = new Date();
    
    if (selectedFilter === "ALL") return allTransactions;
    if (selectedFilter === "TODAY") {
      return allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"));
    }
    if (selectedFilter === "YESTERDAY") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"));
    }
    if (selectedFilter === "THIS_MONTH") {
      return allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "MMMM yyyy") === format(today, "MMMM yyyy"));
    }
    if (selectedFilter === "CUSTOM_DATE" && customDate) {
      return allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === customDate);
    }
    if (selectedFilter === "CUSTOM_MONTH" && customMonth) {
      return allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === customMonth);
    }
    
    return allTransactions;
  }, [allTransactions, selectedFilter, customDate, customMonth]);

  // Calculations for P&L Dashboard
  
  // Group logic for UI and Exports
  const groupedTransactions = useMemo(() => {
    const groups: any[] = [];

    // filteredTransactions is sorted by created_at descending
    filteredTransactions.forEach(t => {
      const timeKey = t.created_at; // Exact timestamp
      const isOut = t.type === 'OUT';
      
      // Find existing nota group with this timestamp and type
      let nota = groups.find(g => g.timeKey === timeKey && g.type === t.type);
      if (!nota) {
        nota = {
          timeKey,
          created_at: t.created_at,
          type: t.type,
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
  const outTransactions = filteredTransactions.filter(t => t.type === 'OUT');
  const inTransactions = filteredTransactions.filter(t => t.type === 'IN');

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



  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    const storeName = 'Karya Bahan';
    doc.text(`${storeName.toUpperCase()} - P&L Report`, 14, 22);
    
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

    const tableColumn = ["Tanggal", "Tipe", "Material", "Qty", "H. Modal/Pcs", "H. Jual/Pcs", "Total (Rp)", "Profit (Rp)"];
    const tableRows: any[] = [];

    filteredTransactions.forEach(t => {
      const typeStr = t.type === 'IN' ? 'BELI (IN)' : 'JUAL (OUT)';
      const priceStr = (t.type === 'IN' ? '-' : '+') + t.total_price.toLocaleString("id-ID");
      const profit = t.type === 'OUT' ? (t.total_price - (t.quantity * (t.cost_price || 0))) : 0;
      const profitStr = t.type === 'OUT' ? `+${profit.toLocaleString("id-ID")}` : '-';
      
      const modalPcsStr = t.type === 'IN' ? (t.total_price / (t.quantity || 1)).toLocaleString("id-ID") : (t.cost_price || 0).toLocaleString("id-ID");
      const jualPcsStr = t.type === 'OUT' ? (t.total_price / (t.quantity || 1)).toLocaleString("id-ID") : '-';

      const rowData = [
        format((t.created_at ? new Date(t.created_at) : new Date(0)), "dd MMM yyyy HH:mm"),
        typeStr,
        (t.materials?.code ? `"[${t.materials.code}] "` + t.materials.name : (t.materials?.name || "Unknown")),
        t.quantity.toString(),
        modalPcsStr,
        jualPcsStr,
        priceStr,
        profitStr
      ];
      tableRows.push(rowData);
    });

    // Add empty row for spacing
    tableRows.push(["", "", "", "", "", "", "", ""]);
    
    // Add Total rows at the bottom
    tableRows.push(["", "", "", "", "", "TOTAL PENJUALAN:", `+${totalSalesRevenue.toLocaleString("id-ID")}`, ""]);
    tableRows.push(["", "", "", "", "", "MODAL KELUAR:", `-${costRecovered.toLocaleString("id-ID")}`, ""]);
    tableRows.push(["", "", "", "", "", "PROFIT BERSIH:", "", `+${realizedProfit.toLocaleString("id-ID")}`]);
    tableRows.push(["", "", "", "", "", "TOTAL PEMBELIAN:", `-${totalPurchaseCost.toLocaleString("id-ID")}`, ""]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      didParseCell: function (data) {
        // Make total rows bold
        if (data.row.index >= tableRows.length - 4 && data.row.index <= tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index === 6 || data.column.index === 7) { // Color the amounts
             if (data.row.index === tableRows.length - 4) data.cell.styles.textColor = [0, 128, 0]; // Penjualan (Green)
             if (data.row.index === tableRows.length - 3) data.cell.styles.textColor = [200, 0, 0]; // HPP (Red)
             if (data.row.index === tableRows.length - 2) data.cell.styles.textColor = [0, 128, 0]; // Profit (Green)
          }
        }
      }
    });

    doc.save(`Laporan_PnL_${activeStore}_${selectedFilter.replace(' ', '_')}.pdf`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    let filterLabel = selectedFilter;
    if (selectedFilter === "TODAY") filterLabel = "Hari Ini";
    else if (selectedFilter === "YESTERDAY") filterLabel = "Kemarin";
    else if (selectedFilter === "THIS_MONTH") filterLabel = "Bulan Ini";
    else if (selectedFilter === "CUSTOM_DATE") filterLabel = customDate;
    else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth;

    const generateSheet = (sheetName: string, transactionsGrouped: Transaction[][]) => {
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31).replace(/[\\/*?:\[\]]/g, ''));
      sheet.columns = [
        { key: "no", width: 6 },
        { key: "date", width: 22 },
        { key: "type", width: 15 },
        { key: "material", width: 30 },
        { key: "qty", width: 12 },
        { key: "modal", width: 20 },
        { key: "jual", width: 20 },
        { key: "total", width: 22 },
        { key: "profit", width: 18 }
      ];

      const headerRow = sheet.addRow({
        no: "NO", date: "TANGGAL", type: "TIPE", material: "NAMA BARANG", qty: "QTY", modal: "HARGA MODAL", jual: "HARGA JUAL", total: "TOTAL TRANSAKSI", profit: "PROFIT/RUGI"
      });
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };

      let totalRevenue = 0;
      let totalExpense = 0;
      let totalNetProfit = 0;
      
      transactionsGrouped.forEach((group, idx) => {
        const timeStr = format(new Date(group[0].created_at), "dd MMM yyyy HH:mm");
        const typeStr = group[0].type === "IN" ? "Restock Masuk" : "Kasir Keluar";
        let notaTotal = 0;
        let notaProfit = 0;

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
            material: item.materials?.name || "-",
            qty: item.quantity,
            modal: item.cost_price,
            jual: isOut ? (itemTotal / item.quantity) : "-",
            total: itemTotal,
            profit: isOut ? profit : "-"
          });

          row.getCell(6).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(7).numFmt = '"Rp" #,##0';
          row.getCell(8).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(9).numFmt = '"Rp" #,##0';
        });

        const subRow = sheet.addRow({
           no: "", date: "", type: "", material: "SUBTOTAL NOTA:", qty: "", modal: "", jual: "", total: notaTotal, profit: group[0].type === "OUT" ? notaProfit : "-"
        });
        subRow.font = { bold: true };
        subRow.getCell(8).numFmt = '"Rp" #,##0';
        if(group[0].type === "OUT") subRow.getCell(9).numFmt = '"Rp" #,##0';
        
        sheet.addRow({});
      });

      sheet.addRow({});
      const gr = sheet.addRow({ material: "GRAND TOTAL", total: "Total Penjualan", profit: totalRevenue });
      gr.font = { bold: true };
      gr.getCell(9).numFmt = '"Rp" #,##0';
      
      const ge = sheet.addRow({ total: "Total Pembelian", profit: totalExpense });
      ge.font = { bold: true };
      ge.getCell(9).numFmt = '"Rp" #,##0';

      const gp = sheet.addRow({ total: "NET PROFIT", profit: totalNetProfit });
      gp.font = { bold: true };
      gp.getCell(9).numFmt = '"Rp" #,##0';
      if (totalNetProfit > 0) gp.getCell(9).font = { bold: true, color: { argb: "FF00B050" } };
      else if (totalNetProfit < 0) gp.getCell(9).font = { bold: true, color: { argb: "FFFF0000" } };
    };

    if (selectedInvestor === "Semua" && investors.length > 0) {
      generateSheet("Semua Transaksi", filteredTransactions);
      investors.forEach(inv => {
        const invTxs = filteredTransactions.map(group => {
           return group.filter(t => {
             const im = t.materials?.name?.match(/\s*=\s*\((.*?)\)$/);
             return im && im[1].trim() === inv;
           });
        }).filter(group => group.length > 0);
        
        if (invTxs.length > 0) {
           generateSheet(`Laporan ${inv}`, invTxs);
        }
      });
    } else {
      generateSheet(selectedInvestor === "Semua" ? "Laporan PnL" : `Laporan ${selectedInvestor}`, filteredTransactions);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Laporan_PnL_${activeStore}_${filterLabel.replace(/\s/g, '_')}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-bold uppercase flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Laporan Keuangan & Laba Rugi
          </h1>
          <p className="text-gray-500 mt-2">Riwayat transaksi, perputaran modal, dan keuntungan bersih.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={exportPDF}
            disabled={loading || filteredTransactions.length === 0}
            className="flex items-center gap-2 border border-black px-4 py-2 font-bold uppercase text-sm hover:bg-black hover:text-white transition-swiss hover-elevate active-press disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button 
            onClick={exportExcel}
            disabled={loading || filteredTransactions.length === 0}
            className="flex items-center gap-2 border border-black bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-800 transition-swiss hover-elevate active-press disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Section M-Banking Style */}
      <div className="bg-gray-100 p-4 border border-black flex flex-wrap items-center gap-4 transition-swiss hover:shadow-sm">
        <Calendar className="w-6 h-6 text-gray-500" />
        <div>
          <div className="flex flex-wrap gap-6">
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
                  <option value="CUSTOM_DATE">Tanggal Spesifik...</option>
                  <option value="CUSTOM_MONTH">Bulan Spesifik...</option>
                </select>
              </div>
              
              {investors.length > 0 && (
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
              )}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <div className="border-2 border-black p-6 bg-black text-white relative hover-elevate transition-swiss shadow-[6px_6px_0_0_#3b82f6] rounded-xl">
            <div className="text-sm font-bold uppercase text-gray-400 mb-2 flex justify-between items-center">
              <span>Sisa Saldo Kas (Budget)</span>
              <button onClick={() => { setIsEditingBudget(true); setTempBudget(initialBudget.toString()); }} className="text-xs border border-gray-600 px-2 py-1 hover:bg-gray-800 transition-colors active-press rounded">
                Set Modal Awal
              </button>
            </div>
            
            {isEditingBudget ? (
              <form onSubmit={saveBudget} className="flex gap-2 mt-2 animate-fade-in">
                <input 
                  type="number" 
                  className="flex-1 bg-transparent border-b border-white text-white focus:outline-none focus:border-gray-400 transition-colors" 
                  value={tempBudget}
                  onChange={(e) => setTempBudget(e.target.value)}
                  placeholder="Modal Awal"
                  autoFocus
                />
                <button type="submit" className="text-xs bg-white text-black px-2 font-bold uppercase hover:bg-gray-200 transition-colors active-press rounded">Save</button>
                <button type="button" onClick={() => setIsEditingBudget(false)} className="text-xs text-gray-400 px-2 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="text-3xl font-mono font-bold">
                Rp <AnimatedNumber value={currentBudget} />
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-2">
              (Modal: Rp {initialBudget.toLocaleString("id-ID")} + Profit: Rp {netBalance.toLocaleString("id-ID")})
            </div>
          </div>
        </div>
      </div>

      {/* P&L DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Modal Keluar */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 hover-elevate transition-swiss shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-lg">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Modal Keluar
          </div>
          <div className="text-2xl font-black text-blue-800">
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
                    <th className="p-4 font-bold">Tipe</th>
                    <th className="p-4 font-bold">Rincian Barang</th>
                    <th className="p-4 font-bold text-center">Total Qty</th>
                    <th className="p-4 font-bold text-right">Total Modal (Rp)</th>
                    <th className="p-4 font-bold text-right">Total Transaksi (Rp)</th>
                    <th className="p-4 font-bold text-right">Profit (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                        Tidak ada transaksi di periode ini.
                      </td>
                    </tr>
                  ) : (
                    groupedTransactions.map((g, idx) => {
                      const isOut = g.type === 'OUT';
                      const profit = isOut ? (g.total_price - g.cost_price) : 0;
                      const materialText = g.items.map((i: any) => `${i.quantity}x ${i.materials?.name?.replace(/-\s*\[.*?\]$/, '').trim() || 'Barang'}`).join(', ');
                      
                      return (
                        <tr key={g.timeKey + g.type} className={`border-b-2 border-gray-300 transition-colors ${isOut ? 'bg-blue-50/30 hover:bg-blue-50' : 'bg-red-50/30 hover:bg-red-50'}`}>
                          <td className={`p-4 font-bold ${isOut ? 'text-blue-900' : 'text-red-900'}`}>
                            {format(new Date(g.created_at), "dd MMM yyyy, HH:mm")}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${isOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isOut ? 'NOTA (OUT)' : 'NOTA (IN)'}
                            </span>
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










