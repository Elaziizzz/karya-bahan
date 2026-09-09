const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// We want to delete lines 122 through 161 (from the first `async function fetchData(store: string) {` to right before `async function fetchMaterials`)
const startIdx = content.indexOf("  async function fetchData(store: string) {\r\n    await fetchMaterials(store);\r\n    await fetchTransactions(store);\r\n  }\r\n  } | null>(null);");
const altStartIdx = content.indexOf("  async function fetchData(store: string) {\n    await fetchMaterials(store);\n    await fetchTransactions(store);\n  }\n  } | null>(null);");

const actualStart = startIdx !== -1 ? startIdx : altStartIdx;
console.log("actualStart index:", actualStart);

if (actualStart !== -1) {
  const targetEndStr = "async function fetchMaterials(store: string) {";
  const endIdx = content.indexOf(targetEndStr, actualStart);
  console.log("endIdx:", endIdx);
  if (endIdx !== -1) {
    content = content.slice(0, actualStart) + content.slice(endIdx);
    fs.writeFileSync("src/app/page.tsx", content);
    console.log("Successfully sliced out duplicate block!");
  }
}
