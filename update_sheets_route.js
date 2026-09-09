const fs = require("fs");
let content = fs.readFileSync("src/app/api/sheets/sync/route.ts", "utf8");

const oldLunas = `        if (action === 'lunas') {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: \`\${year}!A:N\`,
      });
      const rows = res.data.values;
      if (!rows) return NextResponse.json({ error: 'No data found' });
      
      const rowIndex = rows.findIndex((row: any) => row[0] === payload.invoiceNo);
      if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: \`\${year}!L\${rowIndex + 1}:N\${rowIndex + 1}\`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['LUNAS', payload.total, 0]],
          },
        });
      }
      return NextResponse.json({ success: true });
    }`;

const newLunas = `    if (action === 'lunas' || action === 'pelunasan') {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: \`\${year}!A:N\`,
      });
      const rows = res.data.values;
      if (!rows) return NextResponse.json({ error: 'No data found' });
      
      const rowIndex = rows.findIndex((row: any) => row[0] === payload.invoiceNo);
      if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: \`\${year}!L\${rowIndex + 1}:N\${rowIndex + 1}\`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[payload.status || 'LUNAS', payload.dp ?? payload.total, payload.sisa ?? 0]],
          },
        });
      }
      return NextResponse.json({ success: true });
    }`;

content = content.replace(oldLunas, newLunas);
fs.writeFileSync("src/app/api/sheets/sync/route.ts", content);
console.log("Updated sheets sync route.ts successfully!");
