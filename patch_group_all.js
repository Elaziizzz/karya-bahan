const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// Group EVERYTHING (IN and OUT) by timestamp
const groupLogicOld = /\/\/ Group logic for UI and Exports[\s\S]*?const outTransactions = filteredTransactions\.filter\(t => t\.type === 'OUT'\);/;
const groupLogicNew = `// Group logic for UI and Exports
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
  const outTransactions = filteredTransactions.filter(t => t.type === 'OUT');`;

content = content.replace(groupLogicOld, groupLogicNew);

// Now update the table render block
const tableRegex = /<table className="w-full text-left text-sm whitespace-nowrap">[\s\S]*?<\/table>/;
const tableNew = `
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
                      const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim() || 'Barang'}\`).join(', ');
                      
                      return (
                        <tr key={g.timeKey + g.type} className={\`border-b-2 border-gray-300 transition-colors \${isOut ? 'bg-blue-50/30 hover:bg-blue-50' : 'bg-red-50/30 hover:bg-red-50'}\`}>
                          <td className={\`p-4 font-bold \${isOut ? 'text-blue-900' : 'text-red-900'}\`}>
                            {format(new Date(g.created_at), "dd MMM yyyy, HH:mm")}
                          </td>
                          <td className="p-4">
                            <span className={\`px-2 py-1 text-[10px] font-bold rounded uppercase \${isOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}\`}>
                              {isOut ? 'NOTA (OUT)' : 'NOTA (IN)'}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-gray-800 whitespace-normal min-w-[200px]">
                            {materialText}
                          </td>
                          <td className="p-4 text-center font-mono font-bold">{g.quantity}</td>
                          <td className="p-4 text-right font-mono text-gray-600">{g.cost_price.toLocaleString("id-ID")}</td>
                          <td className="p-4 text-right font-mono text-gray-600">{g.total_price.toLocaleString("id-ID")}</td>
                          <td className={\`p-4 text-right font-mono font-black \${isOut ? 'text-blue-600' : 'text-gray-400'}\`}>
                            {isOut ? '+' + profit.toLocaleString("id-ID") : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
`;

content = content.replace(tableRegex, tableNew);

// Update exportPDF
const pdfLoopOld = /groupedTransactions\.forEach\(g => \{[\s\S]*?\}\);/;
const pdfLoopNew = `
    groupedTransactions.forEach(g => {
      const isOut = g.type === 'OUT';
      const profit = isOut ? (g.total_price - g.cost_price) : 0;
      const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim() || 'Barang'}\`).join(', ');
      
      tableRows.push([
        format(new Date(g.created_at), "dd MMM yyyy HH:mm"),
        isOut ? 'NOTA (OUT)' : 'NOTA (IN)',
        materialText,
        g.quantity.toString(),
        g.cost_price.toLocaleString("id-ID"),
        g.total_price.toLocaleString("id-ID"),
        (isOut ? '+' : '-') + g.total_price.toLocaleString("id-ID"),
        isOut ? ('+' + profit.toLocaleString("id-ID")) : '-'
      ]);
    });
`;
content = content.replace(pdfLoopOld, pdfLoopNew);

// Update exportCSV
const csvLoopOld = /groupedTransactions\.forEach\(\(g, index\) => \{[\s\S]*?\}\);/;
const csvLoopNew = `
    groupedTransactions.forEach((g, index) => {
      const isOut = g.type === 'OUT';
      const profit = isOut ? (g.total_price - g.cost_price) : 0;
      const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim() || 'Barang'}\`).join(', ');
      
      const row = worksheet.addRow({
        no: index + 1,
        tanggal: format(new Date(g.created_at), "dd/MM/yyyy HH:mm"),
        tipe: isOut ? 'NOTA (OUT)' : 'NOTA (IN)',
        material: materialText,
        qty: g.quantity,
        modal: g.cost_price,
        jual: g.total_price,
        total: g.total_price,
        profit: profit
      });
      if (isOut) {
        row.font = { bold: true, color: { argb: 'FF004E98' } };
      } else {
        row.font = { bold: true, color: { argb: 'FF980000' } };
      }
    });
`;
content = content.replace(csvLoopOld, csvLoopNew);

fs.writeFileSync("src/app/reports/page.tsx", content);
