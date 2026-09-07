const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// Add state for editing transaction
content = content.replace(
  /const \[cart, setCart\] = useState<CartItem\[\]>\(\[\]\);/,
  `const [cart, setCart] = useState<CartItem[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editQty, setEditQty] = useState("");`
);

// Add global window function for the inline click handler, or just replace window.openEditTx with setEditingTx
content = content.replace(/window\.openEditTx\(t\)/g, `(() => { setEditingTx(t); setEditQty(String(t.quantity)); })()`);

// Add modal JSX before the closing </div> of POSDashboard
const editModal = `
      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 max-w-sm w-full border-2 border-black animate-in zoom-in-95 duration-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 uppercase">Edit Qty Transaksi</h2>
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
                  const newTotal = newQty * (editingTx.cost_price || 0); // Wait, cost_price or price? In Kasir, we store selling price in total_price? Wait, total_price is stored, but what is the unit price? It's (total_price / quantity).
                  const unitPrice = editingTx.total_price / editingTx.quantity;
                  const finalTotal = newQty * unitPrice;
                  
                  const { error } = await supabase.from("transactions").update({ 
                    quantity: newQty, 
                    total_price: finalTotal 
                  }).eq("id", editingTx.id);
                  
                  if(error) alert("Error: " + error.message);
                  else {
                    setEditingTx(null);
                    fetchData("karya_bahan");
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
