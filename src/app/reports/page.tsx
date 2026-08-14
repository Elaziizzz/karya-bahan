"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { FileText, Download, Calendar, Trash2, TrendingUp, DollarSign, Package, PiggyBank } from "lucide-react";
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
  materials?: {
    name: string;
  };
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

  useEffect(() => {
    fetchData("karya_bahan");
  }, []);

  async function fetchData(store: string) {
    setLoading(true);
    // Fetch Transactions
    const { data: trx } = await supabase
      .from("transactions")
      .select("*, materials(name)")
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
    }
  }

  // Get unique months for the filter dropdown
  const monthYears = useMemo(() => {
    const dates = allTransactions.map(t => format(new Date(t.created_at), "MMMM yyyy"));
    return Array.from(new Set(dates)); // Unique
  }, [allTransactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const today = new Date();
    
    if (selectedFilter === "ALL") return allTransactions;
    if (selectedFilter === "TODAY") {
      return allTransactions.filter(t => format(new Date(t.created_at), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"));
    }
    if (selectedFilter === "YESTERDAY") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return allTransactions.filter(t => format(new Date(t.created_at), "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"));
    }
    if (selectedFilter === "THIS_MONTH") {
      return allTransactions.filter(t => format(new Date(t.created_at), "MMMM yyyy") === format(today, "MMMM yyyy"));
    }
    if (selectedFilter === "CUSTOM_DATE" && customDate) {
      return allTransactions.filter(t => format(new Date(t.created_at), "yyyy-MM-dd") === customDate);
    }
    
    return allTransactions.filter(t => format(new Date(t.created_at), "MMMM yyyy") === selectedFilter);
  }, [allTransactions, selectedFilter, customDate]);

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


  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    const storeName = activeStore === 'bysca' ? 'BYSCA (Parfum)' : 'Karya Bahan';
    doc.text(`${storeName.toUpperCase()} - P&L Report`, 14, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    let filterLabel = selectedFilter;
    if (selectedFilter === "TODAY") filterLabel = "Hari Ini";
    else if (selectedFilter === "YESTERDAY") filterLabel = "Kemarin";
    else if (selectedFilter === "THIS_MONTH") filterLabel = "Bulan Ini";
    else if (selectedFilter === "CUSTOM_DATE") filterLabel = customDate ? format(new Date(customDate), "dd MMMM yyyy") : "Tanggal Spesifik";
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
        format(new Date(t.created_at), "dd MMM yyyy HH:mm"),
        typeStr,
        t.materials?.name || "Unknown",
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
      { header: "Tanggal", key: "date", width: 22 },
      { header: "Tipe", key: "type", width: 15 },
      { header: "Material", key: "material", width: 30 },
      { header: "Quantity", key: "qty", width: 12 },
      { header: "H. Modal/Pcs (Rp)", key: "modal", width: 20 },
      { header: "H. Jual/Pcs (Rp)", key: "jual", width: 20 },
      { header: "Total Transaksi (Rp)", key: "total", width: 22 },
      { header: "Profit (Rp)", key: "profit", width: 18 }
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FF000000" } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    filteredTransactions.forEach(t => {
      const profit = t.type === 'OUT' ? (t.total_price - (t.quantity * (t.cost_price || 0))) : 0;
      const isBeli = t.type === 'IN';
      
      const row = sheet.addRow({
        date: format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss"),
        type: isBeli ? 'BELI (IN)' : 'JUAL (OUT)',
        material: t.materials?.name || "Unknown",
        qty: t.quantity,
        modal: isBeli ? t.total_price / (t.quantity || 1) : (t.cost_price || 0),
        jual: isBeli ? "-" : t.total_price / (t.quantity || 1),
        total: isBeli ? -t.total_price : t.total_price,
        profit: isBeli ? "-" : profit
      });

      // Styling based on type
      row.getCell("type").font = { color: { argb: isBeli ? "FF990000" : "FF006600" }, bold: true };
      
      // Values formatting
      row.getCell("total").font = { color: { argb: isBeli ? "FFCC0000" : "FF0000FF" }, bold: true };
      if (!isBeli) row.getCell("profit").font = { color: { argb: "FF009900" }, bold: true };

      // Number formatting for currency columns
      ['modal', 'jual', 'total', 'profit'].forEach(key => {
        const cell = row.getCell(key);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      });
    });

    // Add empty row for spacing
    sheet.addRow({});

    // Totals Section
    const totalSalesRow = sheet.addRow({ qty: "TOTAL PENJUALAN", total: totalSalesRevenue });
    totalSalesRow.getCell("qty").font = { bold: true };
    totalSalesRow.getCell("total").font = { bold: true, color: { argb: "FF0000FF" } };
    totalSalesRow.getCell("total").numFmt = '#,##0';

    const modalKeluarRow = sheet.addRow({ qty: "MODAL KELUAR", total: -costRecovered });
    modalKeluarRow.getCell("qty").font = { bold: true };
    modalKeluarRow.getCell("total").font = { bold: true, color: { argb: "FFCC0000" } };
    modalKeluarRow.getCell("total").numFmt = '#,##0';

    const profitRow = sheet.addRow({ qty: "PROFIT BERSIH", profit: realizedProfit });
    profitRow.getCell("qty").font = { bold: true };
    profitRow.getCell("profit").font = { bold: true, color: { argb: "FF009900" } };
    profitRow.getCell("profit").numFmt = '#,##0';

    const totalBeliRow = sheet.addRow({ qty: "TOTAL PEMBELIAN", total: -totalPurchaseCost });
    totalBeliRow.getCell("qty").font = { bold: true };
    totalBeliRow.getCell("total").font = { bold: true, color: { argb: "FFCC0000" } };
    totalBeliRow.getCell("total").numFmt = '#,##0';

    // Generate and save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Laporan_PnL_${activeStore}_${selectedFilter.replace(' ', '_')}.xlsx`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
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
            className="flex items-center gap-2 border border-black px-4 py-2 font-bold uppercase text-sm hover:bg-black hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button 
            onClick={exportExcel}
            disabled={loading || filteredTransactions.length === 0}
            className="flex items-center gap-2 border border-black bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Section M-Banking Style */}
      <div className="bg-gray-100 p-4 border border-black flex flex-wrap items-center gap-4">
        <Calendar className="w-6 h-6 text-gray-500" />
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih e-Statement (Periode)</label>
          <select 
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="bg-white border border-black px-3 py-2 text-sm font-bold w-64 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="TODAY">Hari Ini</option>
            <option value="YESTERDAY">Kemarin</option>
            <option value="CUSTOM_DATE">Tanggal Spesifik (Kalender)</option>
            <option value="THIS_MONTH">Bulan Ini</option>
            <option value="ALL">Semua Waktu (All Time)</option>
            <optgroup label="Bulan Spesifik">
              {monthYears.map(my => (
                <option key={my} value={my}>{my}</option>
              ))}
            </optgroup>
          </select>
        </div>
        {selectedFilter === "CUSTOM_DATE" && (
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih Tanggal</label>
            <input 
              type="date"
              className="bg-white border border-black px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* P&L DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Modal Keluar */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 transition-colors">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Modal Keluar
          </div>
          <div className="text-2xl font-black text-blue-800">
            Rp {costRecovered.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Uang modal yang sudah balik dari hasil jualan</div>
        </div>
        
        {/* Card 2: Keuntungan Bersih */}
        <div className="border border-black p-4 bg-black text-white relative overflow-hidden group">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Keuntungan Bersih
          </div>
          <div className="text-2xl font-black text-green-400">
            +Rp {realizedProfit.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Profit murni yang masuk kantong (Omzet - Modal)</div>
        </div>

        {/* Card 3: Nilai Stok Mengendap */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 transition-colors">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            Sisa Nilai Stok (Aset)
          </div>
          <div className="text-2xl font-black text-purple-800">
            Rp {totalAssetValue.toLocaleString("id-ID")}
          </div>
          <div className="text-[10px] text-gray-400 mt-2 uppercase">Total uang modal Anda yang nyangkut di barang</div>
        </div>

        {/* Card 4: Potensi Keuntungan */}
        <div className="border border-black p-4 bg-white relative overflow-hidden group hover:bg-gray-50 transition-colors">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
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
      <div className="border border-black bg-white">
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
                    <tr key={t.id} className="hover:bg-gray-50 border-b border-gray-200">
                      <td className="p-4">
                        {format(new Date(t.created_at), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="p-4">
                        {t.type === 'IN' ? (
                          <span className="bg-red-100 text-red-800 px-2 py-1 text-xs font-bold rounded-sm border border-red-200">BELI (IN)</span>
                        ) : (
                          <span className="bg-green-100 text-green-800 px-2 py-1 text-xs font-bold rounded-sm border border-green-200">JUAL (OUT)</span>
                        )}
                      </td>
                      <td className="p-4 font-medium">
                        {t.materials?.name || "Unknown"}
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
                          className="text-gray-400 hover:text-red-600 transition-colors"
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
