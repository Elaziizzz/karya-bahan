const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

content = content.replace(
  /const sheetPayload = cart\.map\(\(item, idx\) => \[\s*insertedData\[idx\]\?\.id \|\| invoiceNo,[\s\S]*?'? VALID'\s*\]\);/,
  `// Group everything into ONE Nota row for Spreadsheet
          const notaItemsText = cart.map(item => \`\${item.display_quantity} \${item.display_unit} \${item.material.name.replace(/-\\s*\\[.*?\\]$/, '').trim()}\`).join(', ');
          const grandTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
          
          const sheetPayload = [[
            invoiceNo, // Kita pakai invoiceNo sebagai ID utamanya di Spreadsheet
            format(now, "yyyy-MM-dd"),
            format(now, "HH:mm"),
            activeStore === 'karya_bahan' ? 'Karya Bahan' : 'Bysca',
            'JUAL (OUT) - NOTA',
            notaItemsText,
            '1 Nota',
            grandTotal,
            '? VALID'
          ]];`
);
fs.writeFileSync("src/app/page.tsx", content);
