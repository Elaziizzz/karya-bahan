const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const newFunctions = `
  async function editFullNota(items: Transaction[]) {
    if (!confirm("Edit Nota ini? Seluruh barang di nota ini akan dipindah kembali ke Keranjang, dan nota asli akan dihapus dari riwayat (Stock akan dikembalikan).")) return;
    
    setLoading(true);
    
    // Soft delete all transactions
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    
    if (error) {
      alert("Gagal mengedit nota: " + error.message);
      setLoading(false);
      return;
    }

    // Load into Cart
    const newCart: any[] = [];
    for (const t of items) {
      const mat = materials.find(m => m.id === t.material_id);
      if (!mat) continue;

      let display_quantity = t.quantity;
      let display_unit = 'Pcs';
      
      const packMatch = mat.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\]$/);
      if (packMatch) {
         const packName = packMatch[1].trim();
         const packMult = Number(packMatch[2]);
         if (t.quantity % packMult === 0 && t.quantity >= packMult) {
           display_quantity = t.quantity / packMult;
           display_unit = packName;
         } else {
           display_unit = packMatch[3].trim();
         }
      } else {
         const baseMatch = mat.name.match(/-\\s*\\[([^=\\]]+?)\\]$/);
         if (baseMatch) {
           display_unit = baseMatch[1].trim();
         }
      }

      newCart.push({
        material: mat,
        quantity: t.quantity,
        display_quantity,
        display_unit,
        subtotal: t.total_price
      });
    }

    setCart(newCart);
    
    ids.forEach(id => {
      fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
      }).catch(console.error);
    });

    setLoading(false);
    fetchData(activeStore);
  }

  async function deleteFullNota(items: Transaction[]) {
    if (!confirm("Hapus Nota ini secara permanen? Stok akan dikembalikan seperti semula.")) return;
    
    setLoading(true);
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    
    if (error) {
      alert("Gagal menghapus nota: " + error.message);
    } else {
      showToast("Nota berhasil dihapus!", "success");
      ids.forEach(id => {
        fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', payload: id, year: new Date().getFullYear().toString() })
        }).catch(console.error);
      });
    }
    setLoading(false);
    fetchData(activeStore);
  }

  // Inject point`;

// Insert the functions right before `function addToCart`
content = content.replace(/function addToCart\(/, newFunctions + '\n  function addToCart(');


// Replace the IIFE logic
const oldIIFE = /return notas\.map\(\(\[time, items\], idx\) => \{[\s\S]*?\}\);/;

const newIIFE = `return notas.map(([time, items], idx) => {
                      const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
                      return (
                        <div key={time} className="border-2 border-black bg-white overflow-hidden shadow-sm">
                          <div className="bg-black text-white p-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="bg-white text-black px-2 py-0.5 font-black text-xs">NOTA #{notas.length - idx}</span>
                              <span className="text-sm">{format(new Date(time), "HH:mm")}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-green-400 font-bold">Total: Rp {totalNota.toLocaleString("id-ID")}</div>
                              <div className="flex gap-2">
                                <button onClick={() => editFullNota(items)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-bold rounded transition-colors border border-blue-800">Edit</button>
                                <button onClick={() => deleteFullNota(items)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-bold rounded transition-colors border border-red-800">Hapus</button>
                              </div>
                            </div>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {items.map((item, itemIdx) => (
                                <tr key={item.id} className={\`\${itemIdx !== items.length - 1 ? 'border-b border-gray-200' : ''} hover:bg-gray-50\`}>
                                  <td className="p-3 font-bold text-gray-800">{item.materials?.name}</td>
                                  <td className="p-3 text-center w-24 font-mono">{item.quantity} x</td>
                                  <td className="p-3 text-right text-green-700 font-bold font-mono w-32">Rp {item.total_price.toLocaleString("id-ID")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    });`;

content = content.replace(oldIIFE, newIIFE);

fs.writeFileSync("src/app/page.tsx", content);
