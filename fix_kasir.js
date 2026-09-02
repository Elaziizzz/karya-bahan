const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const newTypes = `type CartItem = {
  material: Material;
  quantity: number;
  subtotal: number;
  display_quantity: number;
  display_unit: string;
  display_price: number;
  pack_multiplier: number;
};`;
content = content.replace(/type CartItem = \{.*?\};/s, newTypes);

const newLogic = `function addToCart(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedMaterial || !quantity || Number(quantity) <= 0) return;

    let multiplier = 1;
    let baseUnit = 'Pcs';
    let displayUnit = 'Pcs';
    let displayPrice = selectedMaterial.price;
    let isGrosirMode = buyMode === 'grosir';

    const baseMatch = selectedMaterial.name.match(/-\\s*\\[([^=\\]]+?)\\]$$/);
    if (baseMatch) {
      baseUnit = baseMatch[1].trim();
      displayUnit = baseUnit;
    }

    if (isGrosirMode) {
      const match = selectedMaterial.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\]$$/);
      if (match) {
        displayUnit = match[1].trim();
        multiplier = Number(match[2]);
        baseUnit = match[3].trim();
        if (match[4]) {
          displayPrice = Number(match[4]);
        } else {
          displayPrice = selectedMaterial.price * multiplier;
        }
      } else {
        isGrosirMode = false;
      }
    } else {
      const packMatch = selectedMaterial.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\]$$/);
      if (packMatch) {
        baseUnit = packMatch[3].trim();
        displayUnit = baseUnit;
      }
    }

    const qtyNum = Number(quantity);
    const baseQtyNum = qtyNum * multiplier;

    if (baseQtyNum > selectedMaterial.current_stock) {
      showToast("Stok tidak cukup! (Sisa: " + selectedMaterial.current_stock + ")", "error");
      return;
    }

    const subtotal = displayPrice * qtyNum;
    
    setCart(prev => {
      const existing = prev.findIndex(item => item.material.id === selectedMaterial.id && item.display_price === displayPrice && item.display_unit === displayUnit);
      if (existing >= 0) {
        const newCart = [...prev];
        newCart[existing].display_quantity += qtyNum;
        newCart[existing].quantity += baseQtyNum;
        newCart[existing].subtotal += subtotal;
        return newCart;
      }
      return [...prev, { 
        material: selectedMaterial, 
        quantity: baseQtyNum, 
        subtotal, 
        display_quantity: qtyNum,
        display_unit: displayUnit,
        display_price: displayPrice,
        pack_multiplier: multiplier
      }];
    });

    setSelectedMaterialId("");
    setSearchQuery("");
    setQuantity("");
    setBuyMode('ecer');
    if (quantityInputRef.current) quantityInputRef.current.blur();
  }

  function updateItemPrice(index: number, newPriceStr: string) {
    const cleanStr = newPriceStr.replace(/^0+(?=\\d)/, '');
    const parsed = cleanStr === "" ? 0 : parseInt(cleanStr, 10);
    const finalPrice = isNaN(parsed) ? 0 : parsed;
    setCart(prev => prev.map((item, i) => i === index ? { ...item, display_price: finalPrice, subtotal: finalPrice * item.display_quantity } : item)); 
  }`;

content = content.replace(/function addToCart\(e: React\.FormEvent\) \{.*?function updateItemPrice\(index: number, newPriceStr: string\) \{.*?\}\n/s, newLogic + "\n");

const newReceiptRow = `<tr key={idx}>
                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                        <td className="border border-black p-2 font-medium">{item.material.code ? \`[\\${item.material.code}] \` : ''}{item.material.name.replace(/-\\s*\\[.*?\\]$$/, '').trim()}</td>
                        <td className="border border-black p-2 text-center font-bold">
                          {item.display_quantity} {item.display_unit}
                        </td>
                        <td className="border border-black p-2 text-right">{item.display_price.toLocaleString("id-ID")}</td>
                        <td className="border border-black p-2 text-right font-bold">{item.subtotal.toLocaleString("id-ID")}</td>
                      </tr>`;
content = content.replace(/<tr key=\{idx\}>.*?<\/tr>/s, newReceiptRow);

const newCartRow = `<td className="p-3 text-center">{index + 1}</td>
                            <td className="p-3 font-medium">
                              {item.material.code && <span className="text-xs font-mono bg-white px-1 py-0.5 rounded mr-2 border border-black">{item.material.code}</span>}
                              {item.material.name.replace(/-\\s*\\[.*?\\]$$/, '').trim()}
                            </td>
                            <td className="p-3 text-right font-mono">
                                <div className="text-lg">{item.display_quantity} <span className="text-xs text-gray-500">{item.display_unit}</span></div>
                            </td>
                            <td className="p-3 text-right font-mono">
                              <div className="flex items-center justify-end gap-1">
                                <span>Rp</span>
                                <input
                                  type="text"
                                  className="w-24 bg-white border border-gray-300 px-2 py-1 text-right focus:outline-none focus:border-black rounded-none"
                                  value={item.display_price === 0 ? "" : item.display_price}
                                  onChange={(e) => updateItemPrice(index, e.target.value)}
                                />
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono font-bold">Rp {item.subtotal.toLocaleString("id-ID")}</td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => removeFromCart(index)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>`;
content = content.replace(/<td className="p-3 text-center">\{index \+ 1\}<\/td>.*?<\/button>\s*<\/td>/s, newCartRow);

fs.writeFileSync("src/app/page.tsx", content);
