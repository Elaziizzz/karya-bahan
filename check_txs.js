const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
let url="", key="";
env.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) url = line.split("=")[1].trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) key = line.split("=")[1].trim();
});
const supabase = createClient(url, key);
supabase.from("transactions").select("id, type, total_price, created_at, customer_name, customer_phone, payment_status, dp_amount").order("created_at", { ascending: false }).limit(10).then(({data, error}) => {
  console.log("Error:", error);
  console.log("Recent 10 txs:", JSON.stringify(data, null, 2));
});
