import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1p5pDhyKZHGAQkla9D1mYT31ScDyzMGHsOo0zGarjlh4';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^"|"$/g, '').trim();
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  if (!email || !privateKey) {
    return null;
  }
  
  privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

  return new google.auth.JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

async function ensureSheetExists(year: string, sheets: any) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheetExists = res.data.sheets?.some((s: any) => s.properties?.title === year);

  if (!sheetExists) {
    // Create the sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: year,
              },
            },
          },
        ],
      },
    });

    // Write Headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${year}!A1:I1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['ID Transaksi', 'Tanggal', 'Waktu', 'Toko', 'Tipe', 'Nama Barang', 'Qty', 'Total Harga', 'Status']],
      },
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload, year } = body;

    const auth = getAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Google Credentials not configured in .env' }, { status: 500 });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    await ensureSheetExists(year, sheets);

    if (action === 'checkout') {
      // payload is an array of transaction arrays
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${year}!A:I`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: payload,
        },
      });
      return NextResponse.json({ success: true });
    } 
    
    if (action === 'delete' || action === 'restore') {
      // payload is a transaction ID
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${year}!A:I`,
      });

      const rows = res.data.values;
      if (!rows) return NextResponse.json({ error: 'No data found' });

      // Find all rows with this ID (could be multiple if batch checkout has same invoice ID? No, our ID is unique UUID)
      const rowIndex = rows.findIndex((row: any) => row[0] === payload);
      
      if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${year}!I${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [action === 'delete' ? ['Ã¢ÂÅ’ DIHAPUS (BATAL)'] : ['Ã¢Å“â€¦ VALID']],
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




