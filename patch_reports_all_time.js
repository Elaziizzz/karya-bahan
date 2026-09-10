const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// 1. Add "ALL" to dropdown options
content = content.replace(
  '<option value="THIS_MONTH">Bulan Ini</option>',
  '<option value="THIS_MONTH">Bulan Ini</option>\n                  <option value="ALL">Semua Waktu / Seluruh Waktu</option>'
);

// 2. Make sure exportExcel handles "ALL"
if (!content.includes('else if (selectedFilter === "ALL") filterLabel = "Semua Waktu";')) {
  content = content.replace(
    'else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth;',
    'else if (selectedFilter === "CUSTOM_MONTH") filterLabel = customMonth;\n    else if (selectedFilter === "ALL") filterLabel = "Semua Waktu";'
  );
}

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Added 'Semua Waktu / Seluruh Waktu' option to reports/page.tsx!");
