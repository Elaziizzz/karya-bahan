const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");
content = content.replace(
  /\.from\("transactions"\)\s*\.select\("\*, materials\(name\)"\)\s*\.eq\("store", activeStore\)\s*\.eq\("type", "IN"\)\s*\.is\("deleted_at", null\)\s*\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(10\);/,
  `.from("transactions")
      .select("*, materials(name)")
      .eq("store", activeStore)
      .eq("type", "IN")
      .is("deleted_at", null)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order("created_at", { ascending: false });`
);
fs.writeFileSync("src/app/restock/page.tsx", content);
