const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// 1. Add formData.investor
content = content.replace(
  "packCost: '',\n      name:",
  "packCost: '', investor: '',\n      name:"
);
content = content.replace(
  "packCost: '', name:",
  "packCost: '', investor: '', name:"
);

// 2. Fix openEditModal to parse investor
let editModalLogic = `
    function openEditModal(item: Material) {
      setEditingId(item.id);
      let baseUnit = 'Pcs';
      let hasPack = false;
      let packName = 'Pack';
      let packMultiplier = '';
      let packSalePrice = '';
      let investor = '';
      
      const cleanName = item.name.replace(/\\s*-\\s*\\[(.*?)\\](?:\\s*=\\s*\\((.*?)\\))?$/, '');
      const investorMatch = item.name.match(/\\s*=\\s*\\((.*?)\\)$/);
      if (investorMatch) investor = investorMatch[1].trim();

      const unitMatch = item.name.match(/\\s*-\\s*\\[(.*?)\\]/);
      if (unitMatch) {
        const info = unitMatch[1];
        const packMatch = info.match(/1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?$/);
        if (packMatch) {
          hasPack = true;
          packName = packMatch[1].trim();
          packMultiplier = packMatch[2];
          baseUnit = packMatch[3].trim();
          if (packMatch[4]) packSalePrice = packMatch[4];
        } else {
          baseUnit = info.trim();
        }
      }

      setFormData({
        baseUnit, hasPack, packName, packMultiplier, packSalePrice, buyQty: '', packCost: '',
        name: cleanName, unit_info: '', code: item.code || '',
        cost_price: String(item.cost_price), price: String(item.price), current_stock: String(item.current_stock),
        investor
      });
      setIsModalOpen(true);
    }
`;
// Replace the old openEditModal
content = content.replace(/function openEditModal\(item: Material\) \{[\s\S]*?setIsModalOpen\(true\);\s*\}/, editModalLogic.trim());

// 3. Fix handleSubmit to append investor
const oldSubmitFinalName = /let finalName = \`\$\{formData\.name\.trim\(\)\} - \\\[1 \$\{formData\.packName\} = \$\{formData\.packMultiplier\} \$\{formData\.baseUnit\}\$\{packPriceInfo\}\\\]\`;[\s\S]*?let finalName = \`\$\{formData\.name\.trim\(\)\} - \\\[\$\{formData\.baseUnit\}\\\]\`;\s*\}/;

const newSubmitFinalName = `let finalName = \`\${formData.name.trim()} - [1 \${formData.packName} = \${formData.packMultiplier} \${formData.baseUnit}\${packPriceInfo}]\`;
      } else {
        finalName = \`\${formData.name.trim()} - [\${formData.baseUnit}]\`;
      }
      if (formData.investor && formData.investor.trim() !== '') {
        finalName += \` = (\${formData.investor.trim()})\`;
      }`;
content = content.replace(oldSubmitFinalName, newSubmitFinalName);

// 4. Update the render loop pack parsing to ignore investor suffix
const oldMatchPackRender = /const match = item\.name\.match\(\/-\\s\*\\\[1\\s\+\(\[\^=\]\+\?\)\\s\*=\\s\*\(\\d\+\)\\s\+\(\[\^@\\\]\]\+\?\)\(\?:\\s\*@\\s\*\(\\d\+\)\)\?\\\]\$\/\);/g;
const newMatchPackRender = "const match = item.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\](?:\\s*=\\s*\\((.*?)\\))?$/);";
content = content.replace(oldMatchPackRender, newMatchPackRender);

// 5. Add UI for Investor in the Modal
const formUIInject = `
                  <div className="grid grid-cols-2 gap-4 items-start">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold mb-1 uppercase">Investor / Pemilik Barang (Opsional)</label>
                      <input type="text" list="investor-list" className="w-full border border-black p-2 focus-ring transition-swiss" value={formData.investor} onChange={(e) => setFormData({...formData, investor: e.target.value.toUpperCase()})} placeholder="Ketik atau pilih investor..." />
                      <datalist id="investor-list">
                        {Array.from(new Set(materials.map(m => {
                          const im = m.name.match(/\\s*=\\s*\\((.*?)\\)$/);
                          return im ? im[1].trim() : null;
                        }).filter(Boolean))).map(inv => (
                          <option key={inv} value={inv} />
                        ))}
                      </datalist>
                    </div>
                    {/* Satuan & Kemasan */}
`;
content = content.replace(/<div className="grid grid-cols-2 gap-4 items-start">\s*\{\/\* Satuan & Kemasan \*\/\}/, formUIInject.trim());


// 6. FIX STICKY HEADER
// Wrap the header in a sticky container and remove it from the animate container
// Current layout:
// <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
//   <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b-2 border-black pb-4 gap-4 sticky top-0 z-40 bg-[#f8f9fa] pt-4 -mx-4 px-4 shadow-sm">
// We need to move the sticky part OUTSIDE the max-w-7xl div.

const headerRegex = /<div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">[\s\S]*?<div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b-2 border-black pb-4 gap-4 sticky top-0 z-40 bg-\[#f8f9fa\] pt-4 -mx-4 px-4 shadow-sm">[\s\S]*?<h1 className="text-3xl font-bold uppercase flex items-center gap-2">[\s\S]*?<Package className="w-8 h-8" \/>[\s\S]*?MATERIALS \/ INVENTORY[\s\S]*?<\/h1>[\s\S]*?<p className="text-gray-500 mt-2">Manage your products, base prices, and starting stock\.<\/p>[\s\S]*?<\/div>[\s\S]*?<div className="flex flex-wrap gap-4">[\s\S]*?<div className="relative flex-1 sm:flex-none">[\s\S]*?<Search className="absolute left-3 top-1\/2 -translate-y-1\/2 w-5 h-5 text-gray-400" \/>[\s\S]*?<input[\s\S]*?type="text"[\s\S]*?className="w-full sm:w-64 border border-black p-2 pl-10 focus-ring transition-swiss"[\s\S]*?placeholder="Cari\.\.\."[\s\S]*?value=\{searchQuery\}[\s\S]*?onChange=\{\(e\) => setSearchQuery\(e.target.value\)\}[\s\S]*?\/>[\s\S]*?<\/div>[\s\S]*?<button[\s\S]*?onClick=\{\(\) => setShowImportSection\(\!showImportSection\)\}[\s\S]*?className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-black border border-black font-bold uppercase hover:bg-gray-300 transition-swiss hover-elevate active-press"[\s\S]*?>[\s\S]*?<Zap className="w-4 h-4 text-blue-600" \/> AI IMPORT[\s\S]*?<\/button>[\s\S]*?<button[\s\S]*?onClick=\{openAddModal\}[\s\S]*?className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold uppercase hover:bg-gray-800 transition-swiss hover-elevate active-press"[\s\S]*?>[\s\S]*?\+ TAMBAH[\s\S]*?<\/button>[\s\S]*?<\/div>[\s\S]*?<\/div>/;

const matchHeader = content.match(headerRegex);

if (matchHeader) {
  let innerHeader = matchHeader[0].replace('<div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">', '');
  
  // We will pull the header OUT and make it a direct child of the fragment.
  const newHeaderLayout = `
        <div className="sticky top-0 z-40 bg-[#f8f9fa] border-b-2 border-black shadow-sm px-4 md:px-8 py-4 mb-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold uppercase flex items-center gap-2">
                <Package className="w-8 h-8" />
                MATERIALS / INVENTORY
              </h1>
              <p className="text-gray-500 mt-2">Manage your products, base prices, and starting stock.</p>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  className="w-full sm:w-64 border border-black p-2 pl-10 focus-ring transition-swiss"
                  placeholder="Cari..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowImportSection(!showImportSection)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-black border border-black font-bold uppercase hover:bg-gray-300 transition-swiss hover-elevate active-press"
              >
                <Zap className="w-4 h-4 text-blue-600" /> AI IMPORT
              </button>
              <button 
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold uppercase hover:bg-gray-800 transition-swiss hover-elevate active-press"
              >
                + TAMBAH
              </button>
            </div>
          </div>
        </div>
        <div className="px-4 md:px-8 max-w-7xl mx-auto pb-32 animate-fade-in">
  `;
  
  content = content.replace(matchHeader[0], newHeaderLayout.trim());
}

fs.writeFileSync("src/app/materials/page.tsx", content);
console.log("Patched materials page!");
