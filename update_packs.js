const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hmnbcfmpvkzbpjtrnmwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtbmJjZm1wdmt6YnBqdHJubXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Mjc2OTMsImV4cCI6MjEwMjAwMzY5M30.0UyRnaaUe-JTafRiUIGTf-XEXixbCNiNgydZqewwzxk'
);

async function run() {
  const { data: materials, error } = await supabase.from('materials').select('id, name');
  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${materials.length} materials.`);
  let updated = 0;

  for (const m of materials) {
    let newName = m.name;
    if (m.name.includes('[1 LEMBAR]')) {
      newName = m.name.replace(/\[1 LEMBAR\]/i, '[1 Dus = 15 Lembar]');
    } else if (m.name.includes('[LEMBAR]')) {
      newName = m.name.replace(/\[LEMBAR\]/i, '[1 Dus = 15 Lembar]');
    } else if (m.name.includes('[PCS]')) {
      newName = m.name.replace(/\[PCS\]/i, '[1 Pack = 10 Pcs]');
    }

    if (newName !== m.name) {
      const { error: updErr } = await supabase.from('materials').update({ name: newName }).eq('id', m.id);
      if (updErr) console.error('Error updating', m.id, updErr);
      else updated++;
    }
  }
  
  console.log(`Updated ${updated} materials successfully.`);
}

run();
