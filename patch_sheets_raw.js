const fs = require("fs");
let content = fs.readFileSync("src/app/api/sheets/sync/route.ts", "utf8");

content = content.replace(/valueInputOption:\s*'USER_ENTERED'/g, "valueInputOption: 'RAW'");

fs.writeFileSync("src/app/api/sheets/sync/route.ts", content);
console.log("Changed valueInputOption to RAW in sheets sync.");
