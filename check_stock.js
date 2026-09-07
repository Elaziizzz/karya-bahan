const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if(k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkStock() {
  const { data: mats } = await supabase.from('materials').select('name, current_stock').like('name', 'Test Material%').order('created_at', { ascending: false }).limit(1);
  console.log(mats);
}
checkStock();
