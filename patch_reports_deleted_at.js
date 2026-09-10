const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

const oldCode = `    // Fetch Materials for Asset Calculation
    const { data: mats } = await supabase
      .from("materials")
      .select("*")
      .eq("store", store);`;

const newCode = `    // Fetch Materials for Asset Calculation
    const { data: mats } = await supabase
      .from("materials")
      .select("*")
      .eq("store", store)
      .is("deleted_at", null);`;

content = content.replace(oldCode, newCode);
fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Updated reports/page.tsx with .is('deleted_at', null)!");
