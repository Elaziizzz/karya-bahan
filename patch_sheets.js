const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const oldPayload = `            const sheetPayload = [[
              invoiceNo, // Kita pakai invoiceNo sebagai ID utamanya di Spreadsheet
              format(now, "yyyy-MM-dd"),
              format(now, "HH:mm"),
              activeStore === 'karya_bahan' ? 'Karya Bahan' : 'Bysca',
              'JUAL (OUT) - NOTA',
              notaItemsText,
              '1 Nota',
              grandTotal,
              '? VALID'
            ]];`;
            
const newPayload = `            const dpValue = paymentStatus === 'DP' ? (Number(dpAmount) || 0) : grandTotal;
            const sisaValue = grandTotal - dpValue;
            const sheetPayload = [[
              invoiceNo, // Kita pakai invoiceNo sebagai ID utamanya di Spreadsheet
              format(now, "yyyy-MM-dd"),
              format(now, "HH:mm"),
              activeStore === 'karya_bahan' ? 'Karya Bahan' : 'Bysca',
              'JUAL (OUT) - NOTA',
              notaItemsText,
              '1 Nota',
              grandTotal,
              '? VALID',
              customerName || '-',
              customerPhone || '-',
              paymentStatus,
              dpValue,
              sisaValue
            ]];`;

content = content.replace(oldPayload, newPayload);
fs.writeFileSync("src/app/page.tsx", content);
console.log("Patched sheet payload.");

let routeContent = fs.readFileSync("src/app/api/sheets/sync/route.ts", "utf8");
routeContent = routeContent.replace(/!A:I/g, '!A:N');
fs.writeFileSync("src/app/api/sheets/sync/route.ts", routeContent);
console.log("Patched sheets sync range.");
