fetch("https://karya-bahan.vercel.app/api/sheets/sync", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "checkout", payload: [["test_id", "2026-09-03", "12:00", "Toko", "JUAL (OUT)", "Barang test", "1 Pcs", 50000, "? VALID"]], year: "2026" })
})
.then(res => res.text().then(text => console.log("STATUS:", res.status, "BODY:", text)))
.catch(console.error);
