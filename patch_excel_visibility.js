const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// Change border color from light gray (FFD1D5DB) to black (FF000000) so it's highly visible
content = content.replace(/FFD1D5DB/g, 'FF000000');

// Change header background from FF2563EB to FF0070C0 (Standard Blue)
content = content.replace(/FF2563EB/g, 'FF0070C0');

// Subtotal background from FFF3F4F6 to FFCCCCCC (Darker gray)
content = content.replace(/FFF3F4F6/g, 'FFCCCCCC');

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Updated Excel styles to be more visible.");
