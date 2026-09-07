const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// We will find the entire exportExcel block and fix it.
// The block starts with "const exportExcel = async () => {"
// and ends right before "if (!filteredTransactions.length) return;" wait no, "return ( <div"
// Let's just find the exact corrupted text and replace it.

const corruptedStart = "      groupedTransactions.forEach((g, index) => {";
const corruptedEnd = "        } else {";

// Actually, I'll use a regex to match the exact broken block.
// Let's replace the whole groupedTransactions.forEach inside exportExcel.
const regex = /groupedTransactions\.forEach\(\(g, index\) => \{[\s\S]*?\}\);\s*\} else \{[\s\S]*?\}\);\s*\/\/ Alignments:/;

const fix = `groupedTransactions.forEach((g, index) => {
      const isOut = g.type === 'OUT';
      const profit = isOut ? (g.total_price - g.cost_price) : 0;
      const materialText = g.items.map((i: any) => \`\${i.quantity}x \${i.materials?.name?.replace(/-\\s*\\[.*?\\]$/, '').trim() || 'Barang'}\`).join(', ');
      
      const row = sheet.addRow({
        no: index + 1,
        date: format(new Date(g.created_at), "dd/MM/yyyy HH:mm"),
        type: isOut ? 'NOTA (OUT)' : 'NOTA (IN)',
        material: materialText,
        qty: g.quantity,
        modal: g.cost_price,
        jual: g.total_price,
        total: isOut ? g.total_price : -g.total_price,
        profit: profit
      });

      // Alignments: dates left-aligned, numbers right-aligned, text left-aligned`;

content = content.replace(regex, fix);

fs.writeFileSync("src/app/reports/page.tsx", content);
