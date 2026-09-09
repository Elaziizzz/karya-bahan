const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// 1. Update Transaction type in reports/page.tsx
content = content.replace(
  `  deleted_at: string | null;
  store: string;
  materials?: { name: string; code?: string; };`,
  `  deleted_at: string | null;
  store: string;
  payment_status?: string;
  dp_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  materials?: { name: string; code?: string; };`
);

// 2. Add totalPiutang calculation
const matchOut = `  const outTransactions = filteredTransactions.filter((t: any) => t.type === 'OUT');`;
const piutangCalc = `  const outTransactions = filteredTransactions.filter((t: any) => t.type === 'OUT');
  const inTransactions = filteredTransactions.filter((t: any) => t.type === 'IN');

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

content = content.replace(
  `  const outTransactions = filteredTransactions.filter((t: any) => t.type === 'OUT');
  const inTransactions = filteredTransactions.filter((t: any) => t.type === 'IN');`,
  piutangCalc
);

// 3. Update Excel subtotal row and grand total in exportExcel
const oldExcelSubRow = `        const subRow = sheet.addRow({
           no: "", date: "", type: "", material: "SUBTOTAL NOTA:", qty: "", modal: "", jual: "", total: notaTotal, profit: isOutGroup ? notaProfit : "-"
        });`;

const newExcelSubRow = `        const isDpGroup = isOutGroup && group[0]?.payment_status === 'DP';
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

content = content.replace(oldExcelSubRow, newExcelSubRow);

// Add Piutang to Excel Grand Total
const oldExcelGrandTotal = `      const gp = sheet.addRow({ total: "NET PROFIT", profit: totalNetProfit });`;
const newExcelGrandTotal = `      const gpiutang = sheet.addRow({ total: "Total Piutang Belum Lunas", profit: totalPiutang });
      gpiutang.font = { bold: true, color: { argb: "FFB91C1C" } };
      gpiutang.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FFFEE2E2" } };
      gpiutang.getCell(8).alignment = { horizontal: "right" };
      gpiutang.getCell(9).numFmt = '"Rp" #,##0';
      addBorders(gpiutang);

      const gp = sheet.addRow({ total: "NET PROFIT", profit: totalNetProfit });`;

content = content.replace(oldExcelGrandTotal, newExcelGrandTotal);

// 4. Update Financial Summary grid in UI (add Piutang card)
const oldFinGrid = `<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">`;
const newFinGrid = `<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

content = content.replace(oldFinGrid, newFinGrid);

// 5. Update Reports Table Row (add DP badge & customer name)
const oldTableRowType = `<span className={\`px-2 py-1 text-[10px] font-bold rounded uppercase \${isOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}\`}>
                              {isOut ? 'NOTA (OUT)' : 'NOTA (IN)'}
                            </span>`;

const newTableRowType = `<div className="flex flex-wrap items-center gap-1.5">
                              <span className={\`px-2 py-1 text-[10px] font-bold rounded uppercase \${isOut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}\`}>
                                {isOut ? 'NOTA (OUT)' : 'NOTA (IN)'}
                              </span>
                              {isOut && g.items[0]?.payment_status === 'DP' && (
                                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-400 text-black border border-black rounded shadow-[1px_1px_0_0_#000]">
                                  DP (Sisa: Rp {Math.max(0, g.total_price - (Number(g.items[0]?.dp_amount) || 0)).toLocaleString("id-ID")})
                                </span>
                              )}
                              {g.items[0]?.customer_name && g.items[0]?.customer_name !== '-' && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-400 rounded">
                                  ?? {g.items[0].customer_name}
                                </span>
                              )}
                            </div>`;

content = content.replace(oldTableRowType, newTableRowType);

// Make sure Clock is imported in reports/page.tsx
if (!content.includes("Clock,")) {
  content = content.replace('import { FileText,', 'import { FileText, Clock,');
}

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Successfully updated reports/page.tsx with DP and Piutang tracking!");
