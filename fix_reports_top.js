const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

const cleanTop = `type Transaction = {
  id: string;
  material_id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  cost_price: number;
  total_price: number;
  created_at: string;
  deleted_at: string | null;
  store: string;
  payment_status?: string;
  dp_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  materials?: { name: string; code?: string; };
};

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
};

export default function ReportsPage() {`;

content = content.replace(/type Transaction = \{[\s\S]*?export default function ReportsPage\(\) \{/, cleanTop);

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Cleaned up top types in reports/page.tsx!");
