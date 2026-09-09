const fs = require("fs");

// Fix materials TS errors
let mat = fs.readFileSync("src/app/materials/page.tsx", "utf8");
if (!mat.includes("import { createPortal }")) {
  mat = 'import { createPortal } from "react-dom";\n' + mat;
}
mat = mat.replace('value={formData.investor}', 'value={formData.investor || ""}');
fs.writeFileSync("src/app/materials/page.tsx", mat);

// Fix reports TS errors
let rep = fs.readFileSync("src/app/reports/page.tsx", "utf8");
rep = rep.replace(/\.filter\(t =>/g, '.filter((t: any) =>');
rep = rep.replace(/forEach\(t =>/g, 'forEach((t: any) =>');
fs.writeFileSync("src/app/reports/page.tsx", rep);

console.log("Remaining TS errors fixed.");
