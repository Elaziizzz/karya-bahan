const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// We need to modify how the table and export functions render.
// They use `filteredTransactions`. We'll group them for rendering.
const groupLogic = `
  // Group logic for UI and Exports
  const groupedTransactions = useMemo(() => {
    const groups: any[] = [];
    let currentNota: any = null;

    // filteredTransactions is sorted by created_at descending
    filteredTransactions.forEach(t => {
      if (t.type === 'IN') {
        groups.push({ isNota: false, ...t });
      } else {
        const timeKey = t.created_at; // Exact timestamp
        
        // Find existing nota group with this timestamp
        let nota = groups.find(g => g.isNota && g.timeKey === timeKey);
        if (!nota) {
          nota = {
            isNota: true,
            timeKey,
            created_at: t.created_at,
            type: 'OUT',
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
      }
    });
    
    return groups;
  }, [filteredTransactions]);
`;

// Insert the group logic right after filteredTransactions
content = content.replace(
  /const outTransactions = filteredTransactions\.filter\(t => t\.type === 'OUT'\);/,
  groupLogic + "\n  const outTransactions = filteredTransactions.filter(t => t.type === 'OUT');"
);

// Now update the table render
const tableRegex = /<table className="w-full text-left text-sm whitespace-nowrap">[\s\S]*?<\/table>/;
const newTable = `
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-black text-white uppercase tracking-wide text-xs">
                    <th className="p-4 font-bold">Tanggal</th>
                    <th className="p-4 font-bold">Tipe</th>
                    <th className="p-4 font-bold">Material</th>
                    <th className="p-4 font-bold text-center">Qty</th>
                    <th className="p-4 font-bold text-right">H. Modal (Rp)</th>
                    <th className="p-4 font-bold text-right">H. Jual (Rp)</th>
                    <th className="p-4 font-bold text-right">Total (Rp)</th>
                    <th className="p-4 font-bold text-right">Profit (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500 italic">
                        Tidak ada transaksi di periode ini.
                      </td>
                    </tr>
                  ) : (
                    groupedTransactions.map((g, idx) => {
                      if (!g.isNota) {
                        // Restock (IN)
                        return (
                          <tr key={g.id} className="hover:bg-gray-50 border-b border-gray-200 transition-colors">
                            <td className="p-4 font-medium text-gray-700">
                              {format(g.created_at ? new Date(g.created_at) : new Date(0), "dd MMM yyyy, HH:mm")}
                            </td>
                            <td className="p-4">
                              <span className="bg-red-100 text-red-700 px-2 py-1 text-[10px] font-bold rounded uppercase">
                                BELI (IN)
                              </span>
                            </td>
                            <td className="p-4 font-bold text-gray-900">
                              {g.materials?.code && <span className="text-xs font-mono bg-white px-1 py-0.5 rounded mr-2 border border-black">[{g.materials.code}]</span>}
                              {g.materials?.name || "Unknown"}
                            </td>
                            <td className="p-4 text-center font-mono">{g.quantity}</td>
                            <td className="p-4 text-right font-mono text-gray-600">{(g.total_price / (g.quantity || 1)).toLocaleString("id-ID")}</td>
                            <td className="p-4 text-right font-mono text-gray-400">-</td>
                            <td className="p-4 text-right font-mono text-red-600 font-bold">- {g.total_price.toLocaleString("id-ID")}</td>
                            <td className="p-4 text-right font-mono text-gray-400">-</td>
                          </tr>
                        );
                      } else {
                        // Sale (OUT) - Grouped
                        const profit = g.total_price - g.cost_price;
                        const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim()}\`).join(', ');
                        
                        return (
                          <tr key={g.timeKey} className="hover:bg-blue-50 border-b-2 border-gray-300 transition-colors bg-blue-50/30">
                            <td className="p-4 font-bold text-blue-900">
                              {format(new Date(g.created_at), "dd MMM yyyy, HH:mm")}
                            </td>
                            <td className="p-4">
                              <span className="bg-green-100 text-green-700 px-2 py-1 text-[10px] font-bold rounded uppercase">
                                NOTA (OUT)
                              </span>
                            </td>
                            <td className="p-4 font-medium text-gray-800 whitespace-normal min-w-[200px]">
                              {materialText}
                            </td>
                            <td className="p-4 text-center font-mono font-bold">{g.quantity}</td>
                            <td className="p-4 text-right font-mono text-gray-600">{g.cost_price.toLocaleString("id-ID")}</td>
                            <td className="p-4 text-right font-mono text-gray-600">{g.total_price.toLocaleString("id-ID")}</td>
                            <td className="p-4 text-right font-mono text-green-600 font-bold">+ {g.total_price.toLocaleString("id-ID")}</td>
                            <td className="p-4 text-right font-mono text-blue-600 font-black">+ {profit.toLocaleString("id-ID")}</td>
                          </tr>
                        );
                      }
                    })
                  )}
                </tbody>
              </table>
`;
content = content.replace(tableRegex, newTable);
fs.writeFileSync("src/app/reports/page.tsx", content);
