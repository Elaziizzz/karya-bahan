const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

// Add state for editing transaction
content = content.replace(
  /const \[recentRestocks, setRecentRestocks\] = useState<Transaction\[\]>\(\[\]\);/,
  `const [recentRestocks, setRecentRestocks] = useState<Transaction[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");`
);

// Add edit button in table
content = content.replace(
  /<button\s+onClick=\{\(\) => handleDelete\(t.id\)\}\s+className="text-xs border border-red-500 text-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-swiss active-press"\s*>\s*Hapus\s*<\/button>/g,
  `<button onClick={() => { setEditingTx(t); setEditQty(String(t.quantity)); setEditCostPrice(String(t.cost_price || 0)); }} className="text-xs border border-blue-500 text-blue-600 px-2 py-1 hover:bg-blue-600 hover:text-white transition-swiss active-press mr-2">Edit</button>
  <button onClick={() => handleDelete(t.id)} className="text-xs border border-red-500 text-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-swiss active-press">Hapus</button>`
);

// Add modal JSX before the closing </div> of the component
const editModal = `
      {/* Edit Restock Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 max-w-sm w-full border-2 border-black animate-in zoom-in-95 duration-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 uppercase">Edit Restock Qty</h2>
            <div className="mb-4 text-sm">
              <span className="text-gray-500 block mb-1">Barang:</span>
              <span className="font-bold">{editingTx.materials?.name}</span>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold mb-1 uppercase">Quantity Baru</label>
              <input 
                type="number" 
                min="1"
                className="w-full border border-black p-2 focus-ring" 
                value={editQty} 
                onChange={e => setEditQty(e.target.value)} 
              />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-bold mb-1 uppercase">Harga Modal Baru</label>
              <input 
                type="number" 
                min="0"
                className="w-full border border-black p-2 focus-ring" 
                value={editCostPrice} 
                onChange={e => setEditCostPrice(e.target.value)} 
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
                  const newCost = Number(editCostPrice);
                  if(newQty <= 0) return;
                  const finalTotal = newQty * newCost;
                  
                  const { error } = await supabase.from("transactions").update({ 
                    quantity: newQty, 
                    cost_price: newCost,
                    total_price: finalTotal 
                  }).eq("id", editingTx.id);
                  
                  if(error) alert("Error: " + error.message);
                  else {
                    setEditingTx(null);
                    fetchRecentRestocks();
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

fs.writeFileSync("src/app/restock/page.tsx", content);
