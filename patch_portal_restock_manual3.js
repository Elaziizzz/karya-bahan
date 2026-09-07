const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

content = content.replace(
  / {8}<\/div>\r?\n {6}\)\}\r?\n<\/div>/,
  "        </div>\n      ), document.body) : null}\n</div>"
);

fs.writeFileSync("src/app/restock/page.tsx", content);
console.log("Restock manually replaced.");
