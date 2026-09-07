const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

content = content.replace("import { Package", 'import { createPortal } from "react-dom";\nimport { Package');
content = content.replace(
  "{editingTx && (",
  "{editingTx && typeof document !== 'undefined' ? createPortal("
);
content = content.replace(
  "        </div>\n      )}\n</div>",
  "        </div>\n      ), document.body) : null}\n</div>"
);

fs.writeFileSync("src/app/restock/page.tsx", content);
console.log("Restock manually replaced.");
