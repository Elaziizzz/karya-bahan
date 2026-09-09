const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
let url="", key="";
env.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) url = line.split("=")[1].trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) key = line.split("=")[1].trim();
});
const supabase = createClient(url, key);

async function run() {
  // Update Tx 1 (ASEP 1.5jt, DP 500rb)
  await supabase.from("transactions").update({
    customer_name: "ASEP",
    customer_phone: "08123456789",
    payment_status: "DP",
    dp_amount: 500000
  }).eq("id", "57bf3cbd-3b27-4768-b37b-83ee75a8e168");

  // Update Tx 2 (ASEP 2.25jt, DP 1.25jt)
  await supabase.from("transactions").update({
    customer_name: "ASEP",
    customer_phone: "08123456789",
    payment_status: "DP",
    dp_amount: 1250000
  }).eq("id", "a34cb1e2-272c-43f7-a2d4-d4f9088fa312");

  console.log("Updated test transactions to DP status successfully!");
}
run();
