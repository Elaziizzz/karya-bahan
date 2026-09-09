const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// Fix buttons
content = content.replace("<span>? LUNAS</span>", "<span>? BAYAR LUNAS</span>");
content = content.replace("<span>? DP / NYICIL</span>", "<span>? BAYAR DP / NYICIL</span>");
content = content.replace("<span>?? PELUNASAN</span>", "<span>PELUNASAN</span>");
content = content.replace("?? Semua tagihan hutang sudah lunas!", "Semua tagihan hutang sudah lunas!");

// Fix $ in option and text
content = content.replace(
  'option value="">-- PILIH NAMA CUSTOMER (${unpaidDebts.length} BELUM LUNAS) --',
  'option value="">-- PILIH NAMA CUSTOMER ({unpaidDebts.length} BELUM LUNAS) --'
);

content = content.replace(
  "?? ${d.customer_name} | Sisa Hutang: Rp ${d.remainingDebt.toLocaleString('id-ID')} (${format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')})",
  "{d.customer_name} | Sisa Hutang: Rp {d.remainingDebt.toLocaleString('id-ID')} ({format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')})"
);

content = content.replace(
  '<div className="text-lg font-black text-black">?? ${selectedDebt.customer_name}</div>',
  '<div className="text-lg font-black text-black">{selectedDebt.customer_name}</div>'
);

content = content.replace(
  '<div className="text-xs text-gray-600 font-mono">Telp: ${selectedDebt.customer_phone}</div>',
  '<div className="text-xs text-gray-600 font-mono">Telp: {selectedDebt.customer_phone}</div>'
);

content = content.replace(
  '<div className="text-xs font-mono font-bold text-gray-700">\r\n                              ${format(new Date(selectedDebt.created_at), \'dd MMM yyyy HH:mm\')}\r\n                            </div>',
  '<div className="text-xs font-mono font-bold text-gray-700">{format(new Date(selectedDebt.created_at), "dd MMM yyyy HH:mm")}</div>'
);
content = content.replace(
  '<div className="text-xs font-mono font-bold text-gray-700">\n                              ${format(new Date(selectedDebt.created_at), \'dd MMM yyyy HH:mm\')}\n                            </div>',
  '<div className="text-xs font-mono font-bold text-gray-700">{format(new Date(selectedDebt.created_at), "dd MMM yyyy HH:mm")}</div>'
);

content = content.replace(
  '${selectedDebt.items.map(i => `${i.quantity}x ${displayMaterialName(i.materials?.name)}`).join(\', \')}',
  '{selectedDebt.items.map(i => `${i.quantity}x ${displayMaterialName(i.materials?.name)}`).join(", ")}'
);

content = content.replace(
  'Total Belanja:</span>\r\n                            <div className="font-bold font-mono text-sm">Rp ${selectedDebt.totalAmount.toLocaleString(\'id-ID\')}</div>',
  'Total Belanja:</span><div className="font-bold font-mono text-sm">Rp {selectedDebt.totalAmount.toLocaleString("id-ID")}</div>'
);
content = content.replace(
  'Total Belanja:</span>\n                            <div className="font-bold font-mono text-sm">Rp ${selectedDebt.totalAmount.toLocaleString(\'id-ID\')}</div>',
  'Total Belanja:</span><div className="font-bold font-mono text-sm">Rp {selectedDebt.totalAmount.toLocaleString("id-ID")}</div>'
);

content = content.replace(
  'Sudah Dibayar (DP):</span>\r\n                            <div className="font-bold font-mono text-sm text-blue-700">Rp ${selectedDebt.dpAmount.toLocaleString(\'id-ID\')}</div>',
  'Sudah Dibayar (DP):</span><div className="font-bold font-mono text-sm text-blue-700">Rp {selectedDebt.dpAmount.toLocaleString("id-ID")}</div>'
);
content = content.replace(
  'Sudah Dibayar (DP):</span>\n                            <div className="font-bold font-mono text-sm text-blue-700">Rp ${selectedDebt.dpAmount.toLocaleString(\'id-ID\')}</div>',
  'Sudah Dibayar (DP):</span><div className="font-bold font-mono text-sm text-blue-700">Rp {selectedDebt.dpAmount.toLocaleString("id-ID")}</div>'
);

content = content.replace(
  'Rp ${selectedDebt.remainingDebt.toLocaleString(\'id-ID\')}',
  'Rp {selectedDebt.remainingDebt.toLocaleString("id-ID")}'
);

content = content.replace(
  '? LUNAS SEMUA (Rp ${selectedDebt.remainingDebt.toLocaleString(\'id-ID\')})',
  'LUNASI SEMUA (Rp {selectedDebt.remainingDebt.toLocaleString("id-ID")})'
);

content = content.replace(
  '*Nominal tidak bisa melebihi sisa hutang (Maksimal: Rp ${selectedDebt.remainingDebt.toLocaleString(\'id-ID\')})',
  '*Nominal tidak bisa melebihi sisa hutang (Maksimal: Rp {selectedDebt.remainingDebt.toLocaleString("id-ID")})'
);

content = content.replace(
  '? Akan LUNAS PENUH! Nama customer ini akan otomatis hilang dari daftar hutang setelah diproses.',
  '? Akan LUNAS PENUH! Nama customer ini akan otomatis hilang dari daftar hutang setelah diproses.'
);

content = content.replace(
  '? Pembayaran cicilan sebesar Rp ${Number(pelunasanAmount).toLocaleString(\'id-ID\')}. Sisa hutang berikutnya menjadi: Rp ${(selectedDebt.remainingDebt - Number(pelunasanAmount)).toLocaleString(\'id-ID\')}.',
  '? Pembayaran cicilan sebesar Rp {Number(pelunasanAmount).toLocaleString("id-ID")}. Sisa hutang berikutnya menjadi: Rp {(selectedDebt.remainingDebt - Number(pelunasanAmount)).toLocaleString("id-ID")}.'
);

content = content.replace(
  'Sisa Hutang Yang Belum Dibayar: Rp ${Math.max(0, cartTotal - Number(dpAmount)).toLocaleString(\'id-ID\')}',
  'Sisa Hutang Yang Belum Dibayar: Rp {Math.max(0, cartTotal - Number(dpAmount)).toLocaleString("id-ID")}'
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Replaced literal $ and question marks in page.tsx!");
