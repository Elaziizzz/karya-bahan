const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

content = content.replace(
  '<span>{format(receiptData.date, "dd-MMM-yyyy")}</span>',
  '<span>{format(receiptData.date, "dd-MMM-yyyy HH:mm")}</span>'
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Updated date format in receipt to include time.");
