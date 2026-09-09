const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

const oldGenerateSheet = `    const generateSheet = (sheetName: string, transactionsGrouped: Transaction[][]) => {
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
    };`;

const newGenerateSheet = `    const generateSheet = (sheetName: string, transactionsGrouped: Transaction[][]) => {
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31).replace(/[\\\\/*?:\\[\\]]/g, ''));
      sheet.columns = [
        { key: "no", width: 6 },
        { key: "date", width: 22 },
        { key: "type", width: 17 },
        { key: "material", width: 45 },
        { key: "qty", width: 12 },
        { key: "modal", width: 20 },
        { key: "jual", width: 20 },
        { key: "total", width: 22 },
        { key: "profit", width: 18 }
      ];

      const addBorders = (row: any) => {
        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
          if (colNumber <= 9) {
            cell.border = {
              top: {style:'thin', color: {argb:'FFD1D5DB'}},
              left: {style:'thin', color: {argb:'FFD1D5DB'}},
              bottom: {style:'thin', color: {argb:'FFD1D5DB'}},
              right: {style:'thin', color: {argb:'FFD1D5DB'}}
            };
          }
        });
      };

      const headerRow = sheet.addRow({
        no: "NO", date: "TANGGAL", type: "TIPE", material: "NAMA BARANG", qty: "QTY", modal: "HARGA MODAL", jual: "HARGA JUAL", total: "TOTAL TRANSAKSI", profit: "PROFIT/RUGI"
      });
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }; // Blue background
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
          
          addBorders(row);
          if (itemIdx === 0) {
            const typeCell = row.getCell('type');
            typeCell.font = { bold: true, color: { argb: isOut ? "FF047857" : "FFB91C1C" } }; // Emerald / Red font
            typeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isOut ? "FFD1FAE5" : "FFFEE2E2" } };
            typeCell.alignment = { horizontal: "center" };
          }
          
          row.getCell('material').alignment = { wrapText: true };

          row.getCell(6).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(7).numFmt = '"Rp" #,##0';
          row.getCell(8).numFmt = '"Rp" #,##0';
          if(isOut) row.getCell(9).numFmt = '"Rp" #,##0';
        });

        const subRow = sheet.addRow({
           no: "", date: "", type: "", material: "SUBTOTAL NOTA:", qty: "", modal: "", jual: "", total: notaTotal, profit: isOutGroup ? notaProfit : "-"
        });
        subRow.font = { bold: true, color: { argb: "FF374151" } };
        subRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; // Gray background
        addBorders(subRow);
        
        subRow.getCell(8).numFmt = '"Rp" #,##0';
        if(isOutGroup) subRow.getCell(9).numFmt = '"Rp" #,##0';
        
        // Empty row spacer
        sheet.addRow({});
      });

      // Grand Total Section
      const gr = sheet.addRow({ material: "GRAND TOTAL", total: "Total Penjualan", profit: totalRevenue });
      gr.font = { bold: true };
      gr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } }; // Light blue
      gr.getCell(8).alignment = { horizontal: "right" };
      gr.getCell(9).numFmt = '"Rp" #,##0';
      addBorders(gr);
      
      const ge = sheet.addRow({ total: "Total Pembelian", profit: totalExpense });
      ge.font = { bold: true };
      ge.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      ge.getCell(8).alignment = { horizontal: "right" };
      ge.getCell(9).numFmt = '"Rp" #,##0';
      addBorders(ge);

      const gp = sheet.addRow({ total: "NET PROFIT", profit: totalNetProfit });
      gp.font = { bold: true };
      gp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      gp.getCell(8).alignment = { horizontal: "right" };
      gp.getCell(9).numFmt = '"Rp" #,##0';
      if (totalNetProfit > 0) gp.getCell(9).font = { bold: true, color: { argb: "FF00B050" } };
      else if (totalNetProfit < 0) gp.getCell(9).font = { bold: true, color: { argb: "FFFF0000" } };
      addBorders(gp);
    };`;

content = content.replace(oldGenerateSheet, newGenerateSheet);
fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Excel Export beautified.");
