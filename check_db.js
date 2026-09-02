require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.from('materials').select('*').limit(1);
  console.log('Keys:', data && data.length ? Object.keys(data[0]) : 'no data or error', error);
}
check();
