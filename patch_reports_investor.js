const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// 1. Add selectedInvestor state
if (!content.includes("selectedInvestor")) {
  content = content.replace(
    'const [customMonth, setCustomMonth] = useState("");',
    'const [customMonth, setCustomMonth] = useState("");\n  const [selectedInvestor, setSelectedInvestor] = useState("Semua");'
  );
}

// 2. Extract investors
if (!content.includes("const investors = ")) {
  content = content.replace(
    'const filteredTransactions = useMemo(() => {',
    `const investors = useMemo(() => {
    const list = new Set<string>();
    allTransactions.forEach(t => {
      const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
      if (im) list.add(im[1].trim());
    });
    return Array.from(list).sort();
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {`
  );
}

// 3. Filter by selectedInvestor
const oldFilterReturn = /return Array\.from\(grouped\.values\(\)\)\.sort\(\(a, b\) => new Date\(b\[0\]\.created_at\)\.getTime\(\) - new Date\(a\[0\]\.created_at\)\.getTime\(\)\);/;
const newFilterReturn = `let result = Array.from(grouped.values()).flat();
    if (selectedInvestor !== "Semua") {
      result = result.filter(t => {
        const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
        return im && im[1].trim() === selectedInvestor;
      });
    }
    
    // Group back by exact timestamp (nota) after filtering
    const reGrouped = new Map<string, Transaction[]>();
    result.forEach(t => {
      if (!reGrouped.has(t.created_at)) reGrouped.set(t.created_at, []);
      reGrouped.get(t.created_at)!.push(t);
    });

    return Array.from(reGrouped.values()).sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime());`;
content = content.replace(oldFilterReturn, newFilterReturn);

// 4. Update the UI Filter section
const oldFilterUI = /<label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih e-Statement \(Periode\)<\/label>[\s\S]*?<\/select>/;
const newFilterUI = `<div className="flex flex-wrap gap-6">
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
            </div>`;
content = content.replace(oldFilterUI, newFilterUI);

// 5. Enhance exportExcel to split by investor if selectedInvestor === 'Semua'
const oldExportExcel = /const exportExcel = async \(\) => \{[\s\S]*?doc\.save\(/;
// Wait, exportExcel is defined before exportPDF. I will just rewrite exportExcel.
// To reliably replace exportExcel:
const exportExcelRegex = /const exportExcel = async \(\) => \{[\s\S]*?workbook\.xlsx\.writeBuffer\(\);[\s\S]*?saveAs\(blob, \`Laporan_PnL_\$\{activeStore\}_\$\{selectedFilter\.replace\(' ', '_'\)\}\.xlsx\`\);\s*\};/;

const newExportExcel = `const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Determine filter label
    let filterLabel = selectedFilter;
    if (selectedFilter === "TODAY") filterLabel = "Hari Ini";
    else if (selectedFilter === "YESTERDAY") filterLabel = "Kemarin";
    else if (selectedFilter === "THIS_MONTH") filterLabel = "Bulan Ini";
    else if (selectedFilter === "CUSTOM_DATE") filterLabel = customDate;
    else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth;

    // Helper to generate a sheet
    const generateSheet = (sheetName: string, transactionsGrouped: Transaction[][]) => {
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31)); // Excel limit is 31 chars
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

      // Styling Header
      const headerRow = sheet.addRow({
        no: "NO", date: "TANGGAL", type: "TIPE", material: "NAMA BARANG", qty: "QTY", modal: "HARGA MODAL", jual: "HARGA JUAL", total: "TOTAL TRANSAKSI", profit: "PROFIT/RUGI"
      });
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };

      let currentRow = 2;
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

          // Formatting numbers
          row.getCell(6).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(7).numFmt = '"Rp" #,##0';
          row.getCell(8).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(9).numFmt = '"Rp" #,##0';

          if (itemIdx === 0) {
             row.getCell(1).alignment = { vertical: 'top' };
             row.getCell(2).alignment = { vertical: 'top' };
             row.getCell(3).alignment = { vertical: 'top' };
          }
        });

        // Add subtotal row for nota
        const subRow = sheet.addRow({
           no: "", date: "", type: "", material: "SUBTOTAL NOTA:", qty: "", modal: "", jual: "", total: notaTotal, profit: group[0].type === "OUT" ? notaProfit : "-"
        });
        subRow.font = { bold: true };
        subRow.getCell(8).numFmt = '"Rp" #,##0';
        if(group[0].type === "OUT") subRow.getCell(9).numFmt = '"Rp" #,##0';
        
        sheet.addRow({}); // Empty row spacing
      });

      // Add Grand Totals
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
      // Generate one sheet for everyone
      generateSheet("Semua Transaksi", filteredTransactions);
      
      // Generate individual sheets for each investor
      investors.forEach(inv => {
        const invTxs = filteredTransactions.map(group => {
           return group.filter(t => {
             const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
             return im && im[1].trim() === inv;
           });
        }).filter(group => group.length > 0);
        
        if (invTxs.length > 0) {
           generateSheet(\`Laporan \${inv}\`, invTxs);
        }
      });
    } else {
      generateSheet(selectedInvestor === "Semua" ? "Laporan PnL" : \`Laporan \${selectedInvestor}\`, filteredTransactions);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, \`Laporan_PnL_\${activeStore}_\${filterLabel.replace(/\\s/g, '_')}.xlsx\`);
  };`;

content = content.replace(exportExcelRegex, newExportExcel);

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Reports page patched for investors.");
