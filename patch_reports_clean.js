const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// 1. Transaction type
content = content.replace(
  "  store: string;\n  materials?: { name: string; code?: string; };\n};",
  "  store: string;\n  payment_status?: string;\n  dp_amount?: number;\n  customer_name?: string;\n  customer_phone?: string;\n  materials?: { name: string; code?: string; };\n};"
);
content = content.replace(
  "  store: string;\r\n  materials?: { name: string; code?: string; };\r\n};",
  "  store: string;\r\n  payment_status?: string;\r\n  dp_amount?: number;\r\n  customer_name?: string;\r\n  customer_phone?: string;\r\n  materials?: { name: string; code?: string; };\r\n};"
);

// 2. Add totalPiutang
const piutangCode = `  const netBalance = totalSalesRevenue - totalPurchaseCost;
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
  }, [outTransactions]);`;

content = content.replace("  const netBalance = totalSalesRevenue - totalPurchaseCost;\n  const currentBudget = initialBudget + netBalance;", piutangCode);
content = content.replace("  const netBalance = totalSalesRevenue - totalPurchaseCost;\r\n  const currentBudget = initialBudget + netBalance;", piutangCode);

// 3. Import Clock
if (!content.includes("Clock,")) {
  content = content.replace("import { FileText,", "import { FileText, Clock,");
}

// 4. Financial Summary 4-card grid
const oldGrid = `<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">`;
const newGrid = `<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="border-2 border-black p-5 bg-white hover-elevate transition-swiss group shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl">
            <div className="text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-2 group-hover:text-black transition-colors">
              <Clock className="w-4 h-4 text-amber-600" />
              Sisa Piutang (Hutang Customer)
            </div>
            <div className="text-2xl font-mono font-bold text-amber-700">
              Rp <AnimatedNumber value={totalPiutang} />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 uppercase">Total tagihan DP yang belum dilunasi</div>
          </div>`;
content = content.replace(oldGrid, newGrid);

// 5. Reports Table row with DP badge & customer name
const oldTableRow = `{materialText}
                          </td>
                          <td className="p-4 text-center font-mono font-bold">{g.quantity}</td>
                          <td className="p-4 text-right font-mono text-gray-600">{g.cost_price.toLocaleString("id-ID")}</td>
                          <td className="p-4 text-right font-mono text-gray-600">{g.total_price.toLocaleString("id-ID")}</td>
                          <td className={\`p-4 text-right font-mono font-black \${isOut ? 'text-blue-600' : 'text-gray-400'}\`}>
                            {isOut ? '+' + profit.toLocaleString("id-ID") : '-'}
                          </td>`;

const newTableRow = `{materialText}
                            {isOut && g.items[0]?.payment_status === 'DP' && (
                              <div className="mt-1">
                                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-400 text-black border border-black rounded shadow-[1px_1px_0_0_#000]">
                                  DP (Sisa: Rp {Math.max(0, g.total_price - (Number(g.items[0]?.dp_amount) || 0)).toLocaleString("id-ID")})
                                </span>
                              </div>
                            )}
                            {g.items[0]?.customer_name && g.items[0]?.customer_name !== '-' && (
                              <div className="mt-1">
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-400 rounded">
                                  ?? {g.items[0].customer_name}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center font-mono font-bold">{g.quantity}</td>
                          <td className="p-4 text-right font-mono text-gray-600">{g.cost_price.toLocaleString("id-ID")}</td>
                          <td className="p-4 text-right font-mono text-gray-600">{g.total_price.toLocaleString("id-ID")}</td>
                          <td className={\`p-4 text-right font-mono font-black \${isOut ? 'text-blue-600' : 'text-gray-400'}\`}>
                            {isOut ? '+' + profit.toLocaleString("id-ID") : '-'}
                          </td>`;

content = content.replace(oldTableRow, newTableRow);

// 6. Excel subtotal row
const oldExcelSub = `        const subRow = sheet.addRow({
           no: "", date: "", type: "", material: "SUBTOTAL NOTA:", qty: "", modal: "", jual: "", total: notaTotal, profit: isOutGroup ? notaProfit : "-"
        });`;

const newExcelSub = `        const isDpGroup = isOutGroup && group[0]?.payment_status === 'DP';
        const dpVal = Number(group[0]?.dp_amount) || 0;
        const sisaVal = Math.max(0, notaTotal - dpVal);
        const custName = group[0]?.customer_name && group[0]?.customer_name !== '-' ? group[0].customer_name : '';

        let subLabel = "SUBTOTAL NOTA:";
        if (isDpGroup) {
          subLabel = \`SUBTOTAL (DP: Rp \${dpVal.toLocaleString('id-ID')} | SISA HUTANG: Rp \${sisaVal.toLocaleString('id-ID')}\${custName ? ' | ' + custName : ''}):\`;
        } else if (custName) {
          subLabel = \`SUBTOTAL NOTA (\${custName}):\`;
        }

        const subRow = sheet.addRow({
           no: "", date: "", type: "", material: subLabel, qty: "", modal: "", jual: "", total: notaTotal, profit: isOutGroup ? notaProfit : "-"
        });`;

content = content.replace(oldExcelSub, newExcelSub);

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Updated reports/page.tsx cleanly!");
