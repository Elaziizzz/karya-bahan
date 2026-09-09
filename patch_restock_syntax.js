const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");
content = content.replace("    </>\r\n  );\r\n}", "  );\r\n}");
content = content.replace("    </>\n  );\n}", "  );\n}");
fs.writeFileSync("src/app/restock/page.tsx", content);
console.log("Removed stray </>\n");
