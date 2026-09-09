const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const oldBox = `{receiptData.paymentStatus === 'DP' && (
                  <div className="mt-6 border-2 border-black p-3 w-72 float-right text-xs">
                    <p className="font-bold border-b border-black pb-1 mb-2">STATUS PELUNASAN DP:</p>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 border border-black"></div>
                      <span>BELUM LUNAS</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 border border-black"></div>
                      <span>LUNAS (Tgl: ..................)</span>
                    </div>
                    <p className="mt-3 text-[9px] italic">*Bawa nota ini saat pelunasan</p>
                  </div>
                )}`;
content = content.replace(oldBox, "");

fs.writeFileSync("src/app/page.tsx", content);
console.log("Removed the DP pelunasan box from receipt.");
