const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");
content = content.replace("md:hidden", "");
fs.writeFileSync("src/app/materials/page.tsx", content);
