const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// The current layout starts with:
//         <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
//         <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b-2 border-black pb-4 gap-4">
//           <div>
//             <h1 className="text-3xl font-bold uppercase flex items-center gap-2">
//               <Package className="w-8 h-8" />
//               MATERIALS / INVENTORY
//             </h1>
//             <p className="text-gray-500 mt-2">Manage your products, base prices, and starting stock.</p>
//           </div>
//           
//           <div className="flex flex-wrap gap-4 sticky top-0 z-40 bg-[#f4f4f4] pt-4 pb-4 border-b-2 border-black -mx-4 px-4 shadow-sm">
// ...
//               </button>
//             </div>
//           </div>

const headerRegex = /<div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">\s*<div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b-2 border-black pb-4 gap-4">[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/;

const matchHeader = content.match(headerRegex);

if (matchHeader) {
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
  fs.writeFileSync("src/app/materials/page.tsx", content);
  console.log("Patched sticky header!");
} else {
  console.log("Header regex didn't match.");
}
