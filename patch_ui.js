const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const oldCheckoutUI = `<div className="bg-gray-100 p-4 border-t-2 border-black">
                <div className="flex justify-between items-center mb-4">`;

const newCheckoutUI = `<div className="bg-gray-100 p-4 border-t-2 border-black">
                {/* Customer Details */}
                <div className="mb-4 grid grid-cols-2 gap-4 border-b border-gray-300 pb-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 text-gray-700">Nama Customer (Opsional)</label>
                    <input type="text" className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors" value={customerName} onChange={e => setCustomerName(e.target.value.toUpperCase())} placeholder="Mis: PAK BUDI" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1 text-gray-700">No. Telp (Opsional)</label>
                    <input type="text" className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Mis: 0812..." />
                  </div>
                  <div className="col-span-2 flex gap-4 mt-2">
                    <label className="flex items-center gap-2 font-bold text-sm cursor-pointer bg-white px-4 py-2 border border-black rounded shadow-sm hover:bg-gray-50 transition-colors">
                      <input type="radio" name="paymentStatus" checked={paymentStatus === 'LUNAS'} onChange={() => setPaymentStatus('LUNAS')} className="w-4 h-4 accent-black" />
                      BAYAR LUNAS
                    </label>
                    <label className="flex items-center gap-2 font-bold text-sm cursor-pointer bg-white px-4 py-2 border border-black rounded shadow-sm hover:bg-gray-50 transition-colors">
                      <input type="radio" name="paymentStatus" checked={paymentStatus === 'DP'} onChange={() => setPaymentStatus('DP')} className="w-4 h-4 accent-black" />
                      BAYAR DP / NYICIL
                    </label>
                  </div>
                  {paymentStatus === 'DP' && (
                    <div className="col-span-2 animate-fade-in mt-2">
                      <label className="block text-xs font-bold uppercase mb-1 text-blue-800">Nominal DP Dibayar (Rp)</label>
                      <input type="number" className="w-full p-3 border-2 border-blue-600 bg-white font-mono text-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all" value={dpAmount} onChange={e => setDpAmount(e.target.value)} placeholder="Ketik nominal uang muka..." />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mb-4">`;

content = content.replace(oldCheckoutUI, newCheckoutUI);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Injected UI for DP and Customer.");
