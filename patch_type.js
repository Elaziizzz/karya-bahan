const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const oldType = `  deleted_at: string | null;
  store: string;
  materials?: { name: string; code?: string; cost_price?: number };
};`;
const newType = `  deleted_at: string | null;
  store: string;
  materials?: { name: string; code?: string; cost_price?: number };
  payment_status?: string;
  dp_amount?: number;
  customer_name?: string;
  customer_phone?: string;
};`;
content = content.replace(oldType, newType);
fs.writeFileSync("src/app/page.tsx", content);
console.log("Patched Transaction type.");
