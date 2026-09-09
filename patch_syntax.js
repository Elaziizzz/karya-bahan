const fs = require("fs");

let mat = fs.readFileSync("src/app/materials/page.tsx", "utf8");
mat = mat.replace(/\), document\.body\) : null\}/g, ", document.body) : null}");
fs.writeFileSync("src/app/materials/page.tsx", mat);

let res = fs.readFileSync("src/app/restock/page.tsx", "utf8");
res = res.replace(/\), document\.body\) : null\}/g, ", document.body) : null}");
fs.writeFileSync("src/app/restock/page.tsx", res);

console.log("Syntax fixed.");
