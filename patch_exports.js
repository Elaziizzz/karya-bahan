const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// Fix PDF Export
const pdfOldLoop = /filteredTransactions\.forEach\(t => \{[\s\S]*?\}\);/;
const pdfNewLoop = `
    groupedTransactions.forEach(g => {
      if (!g.isNota) {
        // Restock
        tableRows.push([
          format(g.created_at ? new Date(g.created_at) : new Date(0), "dd MMM yyyy HH:mm"),
          'BELI (IN)',
          g.materials?.name || "Unknown",
          g.quantity.toString(),
          (g.total_price / (g.quantity || 1)).toLocaleString("id-ID"),
          '-',
          '-' + g.total_price.toLocaleString("id-ID"),
          '-'
        ]);
      } else {
        // Sale Nota
        const profit = g.total_price - g.cost_price;
        const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim()}\`).join(', ');
        
        tableRows.push([
          format(new Date(g.created_at), "dd MMM yyyy HH:mm"),
          'NOTA (OUT)',
          materialText,
          g.quantity.toString(),
          g.cost_price.toLocaleString("id-ID"),
          g.total_price.toLocaleString("id-ID"),
          '+' + g.total_price.toLocaleString("id-ID"),
          '+' + profit.toLocaleString("id-ID")
        ]);
      }
    });
`;
content = content.replace(pdfOldLoop, pdfNewLoop);

// Fix CSV Export
const csvOldLoop = /filteredTransactions\.forEach\(\(t, index\) => \{[\s\S]*?\}\);/;
const csvNewLoop = `
    groupedTransactions.forEach((g, index) => {
      if (!g.isNota) {
        worksheet.addRow({
          no: index + 1,
          tanggal: format(g.created_at ? new Date(g.created_at) : new Date(0), "dd/MM/yyyy HH:mm"),
          tipe: 'BELI (IN)',
          material: g.materials?.name || "Unknown",
          qty: g.quantity,
          modal: g.total_price / (g.quantity || 1),
          jual: 0,
          total: -g.total_price,
          profit: 0
        });
      } else {
        const profit = g.total_price - g.cost_price;
        const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim()}\`).join(', ');
        
        const row = worksheet.addRow({
          no: index + 1,
          tanggal: format(new Date(g.created_at), "dd/MM/yyyy HH:mm"),
          tipe: 'NOTA (OUT)',
          material: materialText,
          qty: g.quantity,
          modal: g.cost_price,
          jual: g.total_price,
          total: g.total_price,
          profit: profit
        });
        row.font = { bold: true, color: { argb: 'FF004E98' } };
      }
    });
`;
content = content.replace(csvOldLoop, csvNewLoop);

fs.writeFileSync("src/app/reports/page.tsx", content);
