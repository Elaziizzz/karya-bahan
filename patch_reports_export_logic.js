const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

const oldLogic = `    if (selectedInvestor === "Semua" && investors.length > 0) {
      generateSheet("Semua Transaksi", groupedTransactions);
      investors.forEach(inv => {
        const invTxs = groupedTransactions.map(group => {
           return group.filter((t: any) => {
             const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
             return im && im[1].trim() === inv;
           });
        }).filter(group => group.length > 0);
        
        if (invTxs.length > 0) {
           generateSheet(\`Laporan \${inv}\`, invTxs);
        }
      });
    } else {
      generateSheet(selectedInvestor === "Semua" ? "Laporan PnL" : \`Laporan \${selectedInvestor}\`, groupedTransactions);
    }`;

const newLogic = `    // Extract the items array from each nota group
    const groupedItems = groupedTransactions.map((nota: any) => nota.items);

    if (selectedInvestor === "Semua" && investors.length > 0) {
      generateSheet("Semua Transaksi", groupedItems);
      investors.forEach(inv => {
        const invTxs = groupedItems.map((group: any) => {
           return group.filter((t: any) => {
             const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
             return im && im[1].trim() === inv;
           });
        }).filter((group: any) => group.length > 0);
        
        if (invTxs.length > 0) {
           generateSheet(\`Laporan \${inv}\`, invTxs);
        }
      });
    } else {
      generateSheet(selectedInvestor === "Semua" ? "Laporan PnL" : \`Laporan \${selectedInvestor}\`, groupedItems);
    }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Patched groupedTransactions in exportExcel.");
