const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

const target = `  const netBalance = totalSalesRevenue - totalPurchaseCost;
  const currentBudget = initialBudget + netBalance;`;

const addition = `  const netBalance = totalSalesRevenue - totalPurchaseCost;
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

content = content.replace(target, addition);
fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Injected totalPiutang into reports/page.tsx!");
