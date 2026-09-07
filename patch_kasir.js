const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Add state for editing transaction
content = content.replace(
  /const \[cart, setCart\] = useState<CartItem\[\]>\(\[\]\);/,
  `const [cart, setCart] = useState<CartItem[]>([]);\n  const [editingTx, setEditingTx] = useState<Transaction | null>(null);\n  const [editQty, setEditQty] = useState("");`
);

// 2. Modify fetchTransactions to only fetch today's OUT transactions
content = content.replace(
  /\.from\("transactions"\)\s*\.select\("\*, materials\(name\)"\)\s*\.eq\("store", store\)\s*\.is\("deleted_at", null\)\s*\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(10\);/,
  `.from("transactions")
      .select("*, materials(name)")
      .eq("store", store)
      .eq("type", "OUT")
      .is("deleted_at", null)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order("created_at", { ascending: false });`
);

// 3. Find the RECENT TRANSACTIONS section and replace its table
const recentTxSectionRegex = /(<h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">\s*RECENT TRANSACTIONS\s*<\/h2>\s*<div className="overflow-x-auto border border-black bg-white">)[\s\S]*?(<\/div>\s*<\/div>)/;

const newTable = `
              <div className="flex flex-col gap-4 bg-gray-100 p-4">
                {(() => {
                  const grouped = transactions.reduce((acc, t) => {
                    const key = t.created_at;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(t);
                    return acc;
                  }, {} as Record<string, Transaction[]>);
                  
                  const notas = Object.entries(grouped).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
                  
                  if (notas.length === 0) {
                    return <div className="p-8 text-center text-gray-500 italic border border-black bg-white">Belum ada transaksi hari ini.</div>;
                  }

                  return notas.map(([time, items], idx) => {
                    const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
                    return (
                      <div key={time} className="border-2 border-black bg-white overflow-hidden shadow-sm">
                        <div className="bg-black text-white p-3 flex justify-between items-center font-bold">
                          <div>
                            <span className="bg-white text-black px-2 py-1 text-xs mr-2 font-black">NOTA #{notas.length - idx}</span>
                            {format(new Date(time), "HH:mm")}
                          </div>
                          <div className="text-green-400">Total: Rp {totalNota.toLocaleString("id-ID")}</div>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <tbody>
                            {items.map(t => (
                              <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="p-3 w-1/2 font-bold text-gray-800">
                                  {t.materials?.name || "Unknown"}
                                </td>
                                <td className="p-3 text-right font-mono text-gray-600">
                                  {t.quantity} x
                                </td>
                                <td className="p-3 text-right font-mono text-green-600 font-bold">
                                  Rp {(t.total_price || 0).toLocaleString("id-ID")}
                                </td>
                                <td className="p-3 text-center w-32 border-l border-gray-100">
                                  <div className="flex justify-center gap-2">
                                    <button 
                                      onClick={() => { setEditingTx(t); setEditQty(String(t.quantity)); }}
                                      className="text-xs border border-blue-500 text-blue-600 px-2 py-1 hover:bg-blue-600 hover:text-white transition-swiss active-press"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => softDeleteTransaction(t.id)}
                                      className="text-xs border border-red-500 text-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-swiss active-press"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
`;

content = content.replace(recentTxSectionRegex, `$1\n${newTable}\n$2`);

// 4. Add modal JSX before the closing </div> of POSDashboard
const editModal = `
      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 max-w-sm w-full border-2 border-black animate-in zoom-in-95 duration-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 uppercase">Edit Qty Penjualan</h2>
            <div className="mb-4 text-sm">
              <span className="text-gray-500 block mb-1">Barang:</span>
              <span className="font-bold">{editingTx.materials?.name}</span>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold mb-1 uppercase">Quantity Baru</label>
              <input 
                type="number" 
                min="1"
                className="w-full border border-black p-2 focus-ring" 
                value={editQty} 
                onChange={e => setEditQty(e.target.value)} 
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setEditingTx(null)} 
                className="px-4 py-2 border border-black hover:bg-gray-100 font-bold text-sm"
              >
                BATAL
              </button>
              <button 
                onClick={async () => {
                  const newQty = Number(editQty);
                  if(newQty <= 0) return;
                  const unitPrice = editingTx.total_price / editingTx.quantity;
                  const finalTotal = newQty * unitPrice;
                  
                  const { error } = await supabase.from("transactions").update({ 
                    quantity: newQty, 
                    total_price: finalTotal 
                  }).eq("id", editingTx.id);
                  
                  if(error) alert("Error: " + error.message);
                  else {
                    setEditingTx(null);
                    fetchData(activeStore);
                  }
                }} 
                className="px-4 py-2 bg-black text-white font-bold text-sm hover:bg-gray-800"
              >
                SIMPAN
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(/(\n\s*<\/div>\n\s*)$/, editModal + "\n$1");

fs.writeFileSync("src/app/page.tsx", content);
