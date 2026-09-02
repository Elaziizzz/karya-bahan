const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hmnbcfmpvkzbpjtrnmwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtbmJjZm1wdmt6YnBqdHJubXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Mjc2OTMsImV4cCI6MjEwMjAwMzY5M30.0UyRnaaUe-JTafRiUIGTf-XEXixbCNiNgydZqewwzxk'
);
async function run() {
  const { data, error } = await supabase.from('materials').select('*').limit(1);
  console.log(data);
}
run();
