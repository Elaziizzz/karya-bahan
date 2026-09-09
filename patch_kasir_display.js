const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// We need to create a helper function at the top of the component to strip the investor for display
const helperInject = `
  // Helper to hide investor from Kasir display
  const displayMaterialName = (name: string | undefined) => {
    if (!name) return "";
    return name.replace(/\\s*=\\s*\\((.*?)\\)$/, "");
  };
`;

if (!content.includes("displayMaterialName")) {
  content = content.replace(
    "export default function Kasir() {",
    "export default function Kasir() {\n" + helperInject
  );
}

// Replace occurrences of material names with the helper in Kasir UI
// 1. In search results: <div className="font-bold">{m.name}</div>
content = content.replace(
  /<div className="font-bold">\{m\.name\}<\/div>/g,
  '<div className="font-bold">{displayMaterialName(m.name)}</div>'
);
// 2. In Cart: <span className="font-bold">{item.name}</span>
content = content.replace(
  /<span className="font-bold">\{item\.name\}<\/span>/g,
  '<span className="font-bold">{displayMaterialName(item.name)}</span>'
);
// 3. In Recent Transactions: <div className="font-bold">... {t.materials?.name}</div>
content = content.replace(
  /<div className="font-bold text-sm">(.*?) \{t\.materials\?\.name\}<\/div>/g,
  '<div className="font-bold text-sm">$1 {displayMaterialName(t.materials?.name)}</div>'
);
content = content.replace(
  /<span className="font-bold">\{item\.materials\?\.name\}<\/span>/g,
  '<span className="font-bold">{displayMaterialName(item.materials?.name)}</span>'
);

// Write back
fs.writeFileSync("src/app/page.tsx", content);
console.log("Kasir display patched.");
