const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// We can just create a small inline rendering for the name.
const oldDisplay = '<td className="p-4 border-r border-gray-200 font-bold group-hover:text-blue-600 transition-colors">{item.name}</td>';

const newDisplay = `<td className="p-4 border-r border-gray-200 group-hover:text-blue-600 transition-colors">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="font-bold">
                        {item.name.replace(/\\s*=\\s*\\((.*?)\\)$/, '')}
                      </span>
                      {item.name.match(/\\s*=\\s*\\((.*?)\\)$/) && (
                        <span className="text-[10px] bg-yellow-200 text-yellow-900 border border-yellow-400 px-2 py-0.5 font-bold uppercase rounded-sm shadow-sm inline-flex items-center gap-1">
                          <User className="w-3 h-3" /> Investor: {item.name.match(/\\s*=\\s*\\((.*?)\\)$/)?.[1]}
                        </span>
                      )}
                    </div>
                  </td>`;

content = content.replace(oldDisplay, newDisplay);

// Wait, I need to make sure `User` icon is imported from lucide-react
if (!content.includes('import { User')) {
  content = content.replace('import { Package,', 'import { Package, User,');
}

fs.writeFileSync("src/app/materials/page.tsx", content);
console.log("Inventory page patched to show investor badge.");
