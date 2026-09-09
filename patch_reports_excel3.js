const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

const startIndex = content.indexOf("const exportExcel = async () => {");
if (startIndex !== -1) {
  const endMarker = ".xlsx`);";
  const endIndex = content.indexOf(endMarker, startIndex);
  
  if (endIndex !== -1) {
    const fullBlockEnd = content.indexOf("};", endIndex) + 2;
    const oldBlock = content.slice(startIndex, fullBlockEnd);
    
    const newExportExcel = `const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    let filterLabel = selectedFilter;
    if (selectedFilter === "TODAY") filterLabel = "Hari Ini";
    else if (selectedFilter === "YESTERDAY") filterLabel = "Kemarin";
    else if (selectedFilter === "THIS_MONTH") filterLabel = "Bulan Ini";
    else if (selectedFilter === "CUSTOM_DATE") filterLabel = customDate;
    else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth;

    const generateSheet = (sheetName: string, transactionsGrouped: Transaction[][]) => {
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31).replace(/[\\\\/*?:\\[\\]]/g, ''));
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
    saveAs(new Blob([buffer]), \`Laporan_PnL_\${activeStore}_\${filterLabel.replace(/\\s/g, '_')}.xlsx\`);
  };`;

    content = content.replace(oldBlock, newExportExcel);
    fs.writeFileSync("src/app/reports/page.tsx", content);
    console.log("exportExcel replaced successfully.");
  }
}
