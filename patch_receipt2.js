const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Patch Receipt Header
const headerRegex = /(<p>Sales\s*:\s*Admin<\/p>\s*<\/div>)/;
const headerReplacement = `<p>Sales  : Admin</p>
                    <div className="mt-2 border-t border-dashed border-black pt-2 w-48">
                      <p>Customer: <b>{receiptData.customerName || "-"}</b></p>
                      <p>No. Telp: {receiptData.customerPhone || "-"}</p>
                    </div>
                  </div>`;
content = content.replace(headerRegex, headerReplacement);

// 2. Patch Receipt Footer
const footerRegex = /(<span>Total\s*:\s*<\/span>\s*<span>\{receiptData\.total\.toLocaleString\("id-ID"\)\}<\/span>\s*<\/div>\s*<\/div>\s*<\/div>)/;
const footerReplacement = `<span>Total     :</span>
                      <span>{receiptData.total.toLocaleString("id-ID")}</span>
                    </div>
                    {receiptData.paymentStatus === 'DP' && (
                      <div className="border-t border-black border-dashed mt-1 pt-1">
                        <div className="flex justify-between py-1 font-bold">
                          <span>Tunai / DP :</span>
                          <span>{receiptData.dpAmount.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-lg mt-1">
                          <span>SISA KURANG:</span>
                          <span>{(receiptData.total - receiptData.dpAmount).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {receiptData.paymentStatus === 'DP' && (
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
                )}
                <div className="clear-both"></div>`;

content = content.replace(footerRegex, footerReplacement);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Patched receipt via regex.");
