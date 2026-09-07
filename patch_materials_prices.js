const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// Change headers
content = content.replace(
  /<th className="p-4 text-right border-r border-gray-700">H\. Modal \(Rp\)<\/th>/,
  '<th className="p-4 text-right border-r border-gray-700 whitespace-nowrap">H. Modal (Pcs/Dus)</th>'
);
content = content.replace(
  /<th className="p-4 text-right border-r border-gray-700 text-green-400">H\. Jual \(Rp\)<\/th>/,
  '<th className="p-4 text-right border-r border-gray-700 text-green-400 whitespace-nowrap">H. Jual (Pcs/Dus)</th>'
);

// Change H. Modal data cell
const modalOld = /<td className="p-4 border-r border-gray-200 text-right font-mono text-gray-600">\s*\{item\.cost_price\.toLocaleString\("id-ID"\)\}\s*<\/td>/;
const modalNew = `<td className="p-4 border-r border-gray-200 text-right font-mono text-gray-600">
                    {(() => {
                      let display = item.cost_price.toLocaleString("id-ID");
                      const match = item.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\]$/);
                      if (match) {
                         const multiplier = Number(match[2]);
                         const packCost = item.cost_price * multiplier;
                         display = \`\${display} / \${packCost.toLocaleString("id-ID")}\`;
                      }
                      return display;
                    })()}
                  </td>`;
content = content.replace(modalOld, modalNew);

// Change H. Jual data cell
const jualOld = /<td className="p-4 border-r border-gray-200 text-right font-mono font-bold text-green-700">\s*\{item\.price\.toLocaleString\("id-ID"\)\}\s*<\/td>/;
const jualNew = `<td className="p-4 border-r border-gray-200 text-right font-mono font-bold text-green-700">
                    {(() => {
                      let display = item.price.toLocaleString("id-ID");
                      const match = item.name.match(/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\]$/);
                      if (match) {
                         const multiplier = Number(match[2]);
                         let packPrice = item.price * multiplier;
                         if (match[4]) packPrice = Number(match[4]);
                         display = \`\${display} / \${packPrice.toLocaleString("id-ID")}\`;
                      }
                      return display;
                    })()}
                  </td>`;
content = content.replace(jualOld, jualNew);

fs.writeFileSync("src/app/materials/page.tsx", content);
