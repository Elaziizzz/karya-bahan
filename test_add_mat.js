const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if(k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testAddMaterial() {
  const { data: newMaterial, error: matErr } = await supabase.from("materials").insert([
    {
      name: "Test Material " + Date.now(),
      current_stock: 10,
      cost_price: 1000,
      price: 2000,
      store: "karya_bahan",
    },
  ]).select();
  
  console.log("Material Error:", matErr);
  
  if (newMaterial && newMaterial.length > 0) {
    const { data: trxData, error: trxErr } = await supabase.from("transactions").insert([{
      material_id: newMaterial[0].id,
      type: "IN",
      quantity: 10,
      cost_price: 1000,
      total_price: 10000,
      store: "karya_bahan"
    }]);
    
    console.log("Transaction Error:", trxErr);
    console.log("Transaction Data:", trxData);
  }
}
testAddMaterial();
