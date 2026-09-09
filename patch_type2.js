const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

content = content.replace(
  "deleted_at: string | null;",
  `deleted_at: string | null;
  payment_status?: string;
  dp_amount?: number;
  customer_name?: string;
  customer_phone?: string;`
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Patched Transaction type via replacement of deleted_at line.");
