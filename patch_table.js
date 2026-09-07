const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// Only fetch today's OUT transactions for recent
content = content.replace(
  /\.from\("transactions"\)\s*\.select\("\*, materials\(name\)"\)\s*\.eq\("store", store\)\s*\.is\("deleted_at", null\)\s*\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(10\);/,
  `.from("transactions")
      .select("*, materials(name)")
      .eq("store", store)
      .eq("type", "OUT")
      .is("deleted_at", null)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order("created_at", { ascending: false });`
);

// Group transactions by timestamp in the render part
// Let's find the Recent Transactions table
const tableRegex = /<table className="w-full text-left text-sm whitespace-nowrap">[\s\S]*?<\/table>/;

const newTable = `
              <div className="flex flex-col gap-4">
                {(() => {
                  const grouped = transactions.reduce((acc, t) => {
                    const key = t.created_at;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(t);
                    return acc;
                  }, {} as Record<string, Transaction[]>);
                  
                  const notas = Object.entries(grouped).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
                  
                  if (notas.length === 0) {
                    return <div className="p-8 text-center text-gray-500 italic border border-black">Belum ada transaksi hari ini.</div>;
                  }

                  return notas.map(([time, items], idx) => {
                    const totalNota = items.reduce((sum, i) => sum + (i.total_price || 0), 0);
                    return (
                      <div key={time} className="border-2 border-black bg-white overflow-hidden">
                        <div className="bg-gray-100 p-3 border-b-2 border-black flex justify-between items-center font-bold">
                          <div>
                            <span className="bg-black text-white px-2 py-1 text-xs mr-2">NOTA #{notas.length - idx}</span>
                            {format(new Date(time), "HH:mm")}
                          </div>
                          <div className="text-blue-700">Total: Rp {totalNota.toLocaleString("id-ID")}</div>
                        </div>
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <tbody>
                            {items.map(t => (
                              <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                <td className="p-3 w-1/2">
                                  {t.materials?.name || "Unknown"}
                                </td>
                                <td className="p-3 text-right font-mono">
                                  {t.quantity}
                                </td>
                                <td className="p-3 text-right font-mono text-green-600 font-bold">
                                  Rp {(t.total_price || 0).toLocaleString("id-ID")}
                                </td>
                                <td className="p-3 text-center w-32">
                                  <div className="flex justify-center gap-2">
                                    <button 
                                      onClick={() => window.openEditTx(t)}
                                      className="text-xs border border-blue-500 text-blue-600 px-2 py-1 hover:bg-blue-600 hover:text-white transition-swiss"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => softDeleteTransaction(t.id)}
                                      className="text-xs border border-red-500 text-red-600 px-2 py-1 hover:bg-red-600 hover:text-white transition-swiss"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  });
                })()}
              </div>
`;

content = content.replace(tableRegex, newTable);

fs.writeFileSync("src/app/page.tsx", content);
