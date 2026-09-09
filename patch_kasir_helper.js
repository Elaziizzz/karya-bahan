const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const helperInject = `
// Helper to hide investor from Kasir display
const displayMaterialName = (name: string | undefined | null) => {
  if (!name) return "";
  return name.replace(/\\s*=\\s*\\((.*?)\\)$/, "");
};
`;

content = content.replace(
  "export default function POSDashboard() {",
  helperInject + "\nexport default function POSDashboard() {"
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Injected helper.");
