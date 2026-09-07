const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if(k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testRestock() {
  const { data: mats } = await supabase.from('materials').select('*').limit(1);
  if (!mats || mats.length === 0) return console.log('No materials');
  const mat = mats[0];
  
  console.log('Testing restock for:', mat.name);
  
  const insertData = {
    material_id: mat.id,
    type: 'IN',
    quantity: 1,
    cost_price: 1000,
    total_price: 1000,
    store: mat.store
  };
  
  const { data, error } = await supabase.from('transactions').insert([insertData]);
  console.log('Insert Error:', error);
  console.log('Insert Data:', data);
}
testRestock();
