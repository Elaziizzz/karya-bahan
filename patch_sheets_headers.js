const fs = require("fs");

// 1. Update page.tsx line 579
let page = fs.readFileSync("src/app/page.tsx", "utf8");
page = page.replace("'? VALID',", "isDp ? 'BELUM LUNAS' : 'VALID',");
fs.writeFileSync("src/app/page.tsx", page);
console.log("Updated page.tsx sheet status column.");

// 2. Update route.ts
let route = fs.readFileSync("src/app/api/sheets/sync/route.ts", "utf8");

// Update headers
route = route.replace(
  "range: `${year}!A1:I1`,\r\n      valueInputOption: 'RAW',\r\n      requestBody: {\r\n        values: [['ID Transaksi', 'Tanggal', 'Waktu', 'Toko', 'Tipe', 'Nama Barang', 'Qty', 'Total Harga', 'Status']],\r\n      },",
  "range: `${year}!A1:N1`,\n      valueInputOption: 'RAW',\n      requestBody: {\n        values: [['ID Transaksi', 'Tanggal', 'Waktu', 'Toko', 'Tipe', 'Nama Barang', 'Qty', 'Total Harga', 'Status', 'Nama Customer', 'No Telp', 'Status Pembayaran', 'DP Dibayar', 'Sisa Kurang']],\n      },"
);
route = route.replace(
  "range: `${year}!A1:I1`,\n      valueInputOption: 'RAW',\n      requestBody: {\n        values: [['ID Transaksi', 'Tanggal', 'Waktu', 'Toko', 'Tipe', 'Nama Barang', 'Qty', 'Total Harga', 'Status']],\n      },",
  "range: `${year}!A1:N1`,\n      valueInputOption: 'RAW',\n      requestBody: {\n        values: [['ID Transaksi', 'Tanggal', 'Waktu', 'Toko', 'Tipe', 'Nama Barang', 'Qty', 'Total Harga', 'Status', 'Nama Customer', 'No Telp', 'Status Pembayaran', 'DP Dibayar', 'Sisa Kurang']],\n      },"
);

// Update pelunasan update logic
const oldLunasRoute = `      if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: \`\${year}!L\${rowIndex + 1}:N\${rowIndex + 1}\`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[payload.status || 'LUNAS', payload.dp ?? payload.total, payload.sisa ?? 0]],
          },
        });
      }`;

const newLunasRoute = `      if (rowIndex !== -1) {
        const isFullLunas = payload.status === 'LUNAS';
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: \`\${year}!I\${rowIndex + 1}\`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[isFullLunas ? 'VALID' : 'BELUM LUNAS']],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: \`\${year}!L\${rowIndex + 1}:N\${rowIndex + 1}\`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[payload.status || 'LUNAS', payload.dp ?? payload.total, payload.sisa ?? 0]],
          },
        });
      }`;

route = route.replace(oldLunasRoute, newLunasRoute);

fs.writeFileSync("src/app/api/sheets/sync/route.ts", route);
console.log("Updated route.ts sheets sync!");
