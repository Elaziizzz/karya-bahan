const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Fix fetchTransactions query to include code
content = content.replace(
  /\.select\("\*, materials\(name\)"\)/g,
  '.select("*, materials(name, code)")'
);

// 2. Update editFullNota to include display_price and pack_multiplier
const oldEditNota = /async function editFullNota\(items: Transaction\[\]\) \{[\s\S]*?fetchData\(activeStore\);\s*\}/;

const newEditNota = `async function editFullNota(items: Transaction[]) {
    if (!confirm("Edit Nota ini? Seluruh barang di nota ini akan dipindah kembali ke Keranjang, dan nota asli akan dihapus dari riwayat (Stock akan dikembalikan).")) return;
    
    setLoading(true);
    
    const ids = items.map(t => t.id);
    const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    
    if (error) {
      alert("Gagal mengedit nota: " + error.message);
      setLoading(false);
      return;
    }

    const newCart: CartItem[] = [];
    for (const t of items) {
      const mat = materials.find(m => m.id === t.material_id);
      if (!mat) continue;

      let display_quantity = t.quantity;
      let display_unit = 'Pcs';
      let pack_multiplier = 1;
      
      const packMatch = mat.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\]$/);
      if (packMatch) {
         const packName = packMatch[1].trim();
         const packMult = Number(packMatch[2]);
         if (t.quantity % packMult === 0 && t.quantity >= packMult) {
           display_quantity = t.quantity / packMult;
           display_unit = packName;
           pack_multiplier = packMult;
         } else {
           display_unit = packMatch[3].trim();
         }
      } else {
         const baseMatch = mat.name.match(/-\\s*\\[([^=\\]]+?)\\]$/);
         if (baseMatch) {
           display_unit = baseMatch[1].trim();
         }
      }

      // Calculate the display_price derived from subtotal and display_quantity
      let display_price = Math.round(t.total_price / display_quantity);

      newCart.push({
        material: mat,
        quantity: t.quantity,
        display_quantity,
        display_unit,
        display_price,
        pack_multiplier,
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
  }`;

content = content.replace(oldEditNota, newEditNota);

// 3. Update the Recent Transactions table row to show code
const oldTableRow = /<td className="p-3 font-bold text-gray-800">\{item\.materials\?\.name\}<\/td>/;
const newTableRow = `<td className="p-3 font-bold text-gray-800">
                                    {item.materials?.code && <span className="text-xs font-mono bg-gray-200 px-1 py-0.5 rounded mr-2 border border-black">[{item.materials.code}]</span>}
                                    {item.materials?.name}
                                  </td>`;
content = content.replace(oldTableRow, newTableRow);

fs.writeFileSync("src/app/page.tsx", content);
