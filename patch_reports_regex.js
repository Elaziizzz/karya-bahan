const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

content = content.replace(
  /\.from\("materials"\)\r?\n\s*\.select\("\*"\)\r?\n\s*\.eq\("store", store\);/,
  '.from("materials")\n      .select("*")\n      .eq("store", store)\n      .is("deleted_at", null);'
);

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Replaced using regex!");
