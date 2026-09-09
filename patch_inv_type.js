const fs = require("fs");
let mat = fs.readFileSync("src/app/materials/page.tsx", "utf8");
mat = mat.replace(
  '<option key={inv} value={inv} />',
  '<option key={inv as string} value={inv as string} />'
);
fs.writeFileSync("src/app/materials/page.tsx", mat);
console.log("Fixed inv type.");
