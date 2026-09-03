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
    const sheet = workbook.addWorksheet("Laporan PnL");

    // Define columns
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

    // Determine filter label
    let filterLabel = selectedFilter;
    if (selectedFilter === "TODAY") filterLabel = "Hari Ini";
    else if (selectedFilter === "YESTERDAY") filterLabel = "Kemarin";
    else if (selectedFilter === "THIS_MONTH") filterLabel = "Bulan Ini";
    else if (selectedFilter === "CUSTOM_DATE") filterLabel = customDate ? format(new Date(customDate), "dd MMMM yyyy") : "Tanggal Spesifik";
    else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth ? format(new Date(customMonth + "-01"), "MMMM yyyy") : "Bulan Spesifik";
    else if (selectedFilter === "ALL") filterLabel = "Semua Waktu";

    const printDate = format(new Date(), "dd MMM yyyy, HH:mm");

    // Row 1: Title Row
    const titleRow = sheet.addRow(["LAPORAN KEUANGAN - KARYA BAHAN"]);
    sheet.mergeCells(1, 1, 1, 9);
    titleRow.height = 30;
    const titleCell = titleRow.getCell(1);
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2: Subtitle Row
    const subtitleRow = sheet.addRow([`Periode: ${filterLabel}  |  Dicetak pada: ${printDate}`]);
    sheet.mergeCells(2, 1, 2, 9);
    subtitleRow.height = 20;
    const subtitleCell = subtitleRow.getCell(1);
    subtitleCell.font = { size: 10, color: { argb: "FF555555" } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Empty row
    sheet.addRow([]);

    // Row 4: Header Row
    const headerRow = sheet.addRow([
      "No",
      "Tanggal",
      "Tipe",
      "Material",
      "Quantity",
      "H. Modal/Pcs (Rp)",
      "H. Jual/Pcs (Rp)",
      "Total Transaksi (Rp)",
      "Profit (Rp)"
    ]);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FF000000" } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Freeze panes up to header row
    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    filteredTransactions.forEach((t, index) => {
      const profit = t.type === 'OUT' ? (t.total_price - (t.quantity * (t.cost_price || 0))) : 0;
      const isBeli = t.type === 'IN';
      
      const row = sheet.addRow({
        no: index + 1,
        date: format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd HH:mm:ss"),
        type: isBeli ? 'BELI (IN)' : 'JUAL (OUT)',
        material: (t.materials?.code ? `"[${t.materials.code}] "` + t.materials.name : (t.materials?.name || "Unknown")),
        qty: t.quantity,
        modal: isBeli ? t.total_price / (t.quantity || 1) : (t.cost_price || 0),
        jual: isBeli ? "-" : t.total_price / (t.quantity || 1),
        total: isBeli ? -t.total_price : t.total_price,
        profit: isBeli ? "-" : profit
      });

      // Alignments: dates left-aligned, numbers right-aligned, text left-aligned
      row.getCell("no").alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell("date").alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell("type").alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell("material").alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell("qty").alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell("modal").alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell("jual").alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell("total").alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell("profit").alignment = { vertical: 'middle', horizontal: 'right' };

      // Styling based on type
      row.getCell("type").font = { color: { argb: isBeli ? "FF990000" : "FF006600" }, bold: true };
      
      // Values formatting
      row.getCell("total").font = { color: { argb: isBeli ? "FFCC0000" : "FF0000FF" }, bold: true };
      if (!isBeli) row.getCell("profit").font = { color: { argb: "FF009900" }, bold: true };

      // Number formatting for currency and quantity columns
      row.getCell("qty").numFmt = '#,##0';
      ['modal', 'jual', 'total', 'profit'].forEach(key => {
        const cell = row.getCell(key);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      });

      // Borders on all cells and alternating row background color
      for (let col = 1; col <= 9; col++) {
        const cell = row.getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: "FFF5F5F5" }
          };
        }
      }
    });

    // Add empty row for spacing
    sheet.addRow({});

    // Totals Section
    const totalSalesRow = sheet.addRow({ material: "TOTAL PENJUALAN", total: totalSalesRevenue });
    const modalKeluarRow = sheet.addRow({ material: "MODAL KELUAR", total: -costRecovered });
    const profitRow = sheet.addRow({ material: "PROFIT BERSIH", profit: realizedProfit });
    const totalBeliRow = sheet.addRow({ material: "TOTAL PEMBELIAN", total: -totalPurchaseCost });

    const summaryRows = [totalSalesRow, modalKeluarRow, profitRow, totalBeliRow];

    summaryRows.forEach((row, index) => {
      // Gray background and borders for summary rows (thick top border on the first summary row)
      for (let col = 1; col <= 9; col++) {
        const cell = row.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: "FFF0F0F0" }
        };
        cell.border = {
          top: { style: index === 0 ? 'thick' : 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      // Merge label across material + qty columns (col 4 and 5)
      sheet.mergeCells(row.number, 4, row.number, 5);
      const labelCell = row.getCell("material");
      labelCell.font = { bold: true };
      labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    });

    totalSalesRow.getCell("total").font = { bold: true, color: { argb: "FF0000FF" } };
    totalSalesRow.getCell("total").numFmt = '#,##0';
    totalSalesRow.getCell("total").alignment = { vertical: 'middle', horizontal: 'right' };

    modalKeluarRow.getCell("total").font = { bold: true, color: { argb: "FFCC0000" } };
    modalKeluarRow.getCell("total").numFmt = '#,##0';
    modalKeluarRow.getCell("total").alignment = { vertical: 'middle', horizontal: 'right' };

    profitRow.getCell("profit").font = { bold: true, color: { argb: "FF009900" } };
    profitRow.getCell("profit").numFmt = '#,##0';
    profitRow.getCell("profit").alignment = { vertical: 'middle', horizontal: 'right' };

    totalBeliRow.getCell("total").font = { bold: true, color: { argb: "FFCC0000" } };
    totalBeliRow.getCell("total").numFmt = '#,##0';
    totalBeliRow.getCell("total").alignment = { vertical: 'middle', horizontal: 'right' };

    // Generate and save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Laporan_PnL_${activeStore}_${selectedFilter.replace(' ', '_')}.xlsx`);
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
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih e-Statement (Periode)</label>
          <select 
            value={selectedFilter}
            onChange={(e) => {
              setSelectedFilter(e.target.value);
              if (e.target.value === "CUSTOM_DATE" && !customDate) setCustomDate(format(new Date(), "yyyy-MM-dd"));
              if (e.target.value === "CUSTOM_MONTH" && !customMonth) setCustomMonth(format(new Date(), "yyyy-MM"));
            }}
            className="bg-white border border-black px-3 py-2 text-sm font-bold w-64 focus-ring cursor-pointer transition-swiss"
          >
            <option value="TODAY">Hari Ini</option>
            <option value="YESTERDAY">Kemarin</option>
            <option value="THIS_MONTH">Bulan Ini</option>
            <option value="CUSTOM_DATE">Tanggal Spesifik (Harian)</option>
            <option value="CUSTOM_MONTH">Bulan Spesifik (Bulanan)</option>
            <option value="ALL">Semua Waktu (All Time)</option>
          </select>
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
                <th className="p-4 font-bold">Material</th>
                <th className="p-4 font-bold text-right">Qty</th>
                <th className="p-4 font-bold text-right text-yellow-400">H. Modal/Pcs (Rp)</th>
                <th className="p-4 font-bold text-right text-blue-400">H. Jual/Pcs (Rp)</th>
                <th className="p-4 font-bold text-right">Total Transaksi (Rp)</th>
                <th className="p-4 font-bold text-right text-green-400">Profit Bersih (Rp)</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 italic">Memuat laporan...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 italic">Tidak ada transaksi di periode ini.</td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const profit = t.type === 'OUT' ? (t.total_price - (t.quantity * (t.cost_price || 0))) : 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 border-b border-gray-200 transition-swiss">
                      <td className="p-4">
                        {format((t.created_at ? new Date(t.created_at) : new Date(0)), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="p-4">
                        {t.type === 'IN' ? (
                          <span className="bg-red-100 text-red-800 px-2 py-1 text-xs font-bold rounded-sm border border-red-200">BELI (IN)</span>
                        ) : (
                          <span className="bg-green-100 text-green-800 px-2 py-1 text-xs font-bold rounded-sm border border-green-200">JUAL (OUT)</span>
                        )}
                      </td>
                      <td className="p-4 font-medium">
                        {(t.materials?.code ? `"[${t.materials.code}] "` + t.materials.name : (t.materials?.name || "Unknown"))}
                      </td>
                      <td className="p-4 text-right font-mono">
                        {t.quantity}
                      </td>
                      <td className="p-4 text-right font-mono text-gray-600">
                        {t.type === 'IN' 
                          ? (t.total_price / (t.quantity || 1)).toLocaleString("id-ID")
                          : (t.cost_price || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 text-right font-mono text-blue-700 font-bold">
                        {t.type === 'OUT' 
                          ? (t.total_price / (t.quantity || 1)).toLocaleString("id-ID")
                          : "-"}
                      </td>
                      <td className={`p-4 text-right font-mono font-bold ${t.type === 'IN' ? 'text-red-600' : 'text-blue-700'}`}>
                        {t.type === 'IN' ? '-' : '+'} {t.total_price.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-green-700">
                        {t.type === 'OUT' ? `+ ${profit.toLocaleString("id-ID")}` : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => softDeleteTransaction(t.id)}
                          className="text-gray-400 hover:text-red-600 transition-swiss active-press"
                          title="Buang ke Tong Sampah"
                        >
                          <Trash2 className="w-5 h-5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {/* TOTALS FOOTER */}
            {!loading && filteredTransactions.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-black">
                <tr>
                  <td colSpan={5}></td>
                  <td className="p-4 text-right font-bold uppercase text-xs text-gray-500">Omzet Penjualan (Kotor)</td>
                  <td className="p-4 text-right font-mono font-bold text-blue-700">+{totalSalesRevenue.toLocaleString("id-ID")}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td colSpan={5}></td>
                  <td className="p-4 text-right font-bold uppercase text-xs text-gray-500">Modal Keluar</td>
                  <td className="p-4 text-right font-mono font-bold text-red-700">-{costRecovered.toLocaleString("id-ID")}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="border-t-2 border-black bg-black text-white">
                  <td colSpan={5}></td>
                  <td className="p-4 text-right font-bold uppercase text-sm">TOTAL PROFIT BERSIH</td>
                  <td className="p-4 text-right font-mono font-bold text-green-400 text-lg" colSpan={2}>
                    +{realizedProfit.toLocaleString("id-ID")}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}









