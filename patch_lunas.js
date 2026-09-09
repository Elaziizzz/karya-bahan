const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Inject lunasiNota function
const deleteFuncMatch = `  async function deleteFullNota(items: Transaction[]) {`;
const lunasiFunc = `  async function lunasiNota(items: Transaction[]) {
    const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
    const dp = Number(items[0].dp_amount) || 0;
    const sisa = totalNota - dp;
    if (!confirm(\`Konfirmasi pelunasan sisa tagihan sebesar Rp \${sisa.toLocaleString("id-ID")} untuk nota ini?\`)) return;
    
    setLoading(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ payment_status: 'LUNAS', dp_amount: totalNota }).in("id", ids);
    
    if (error) {
      alert("Gagal memproses pelunasan: " + error.message);
    } else {
      showToast("Pelunasan berhasil diproses!", "success");
      const invoiceNo = \`KB-\${new Date(items[0].created_at || 0).getTime()}\`;
      try {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lunas', payload: { invoiceNo, total: totalNota }, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      } catch (e) { console.error(e); }
    }
    setLoading(false);
    fetchData(activeStore);
  }

  async function deleteFullNota(items: Transaction[]) {`;

content = content.replace(deleteFuncMatch, lunasiFunc);

// 2. Inject UI Buttons
const uiMatch = /<div className="text-green-400 font-bold">Total: Rp \{totalNota\.toLocaleString\("id-ID"\)\}<\/div>\s*<div className="flex gap-2">/g;
const uiReplace = `<div className="text-green-400 font-bold">Total: Rp {totalNota.toLocaleString("id-ID")}</div>
                                {items[0]?.payment_status === 'DP' && (
                                  <div className="bg-yellow-500 text-black px-2 py-0.5 text-xs font-bold animate-pulse rounded border border-black">BELUM LUNAS</div>
                                )}
                                <div className="flex gap-2">
                                  {items[0]?.payment_status === 'DP' && (
                                    <button onClick={() => lunasiNota(items)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs font-bold rounded transition-colors border border-green-800 shadow-[2px_2px_0_0_#000]">LUNASKAN</button>
                                  )}`;

content = content.replace(uiMatch, uiReplace);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Injected lunasiNota logic and UI.");

// 3. Patch api/sheets/sync/route.ts
let route = fs.readFileSync("src/app/api/sheets/sync/route.ts", "utf8");
const lunasAction = `    if (action === 'lunas') {
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
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });`;

route = route.replace(/return NextResponse\.json\(\{ error: 'Invalid action' \}, \{ status: 400 \}\);/g, lunasAction);
fs.writeFileSync("src/app/api/sheets/sync/route.ts", route);
console.log("Injected sheets sync logic.");
