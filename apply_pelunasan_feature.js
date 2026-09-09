const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Replace paymentStatus state with paymentMode and add unpaid debts states
content = content.replace(
  'const [paymentStatus, setPaymentStatus] = useState<"LUNAS" | "DP">("LUNAS");',
  `const [paymentMode, setPaymentMode] = useState<"LUNAS" | "DP" | "PELUNASAN">("LUNAS");
  const [unpaidTransactions, setUnpaidTransactions] = useState<Transaction[]>([]);
  const [selectedDebtKey, setSelectedDebtKey] = useState<string>("");
  const [pelunasanAmount, setPelunasanAmount] = useState<string>("");`
);

// 2. Update fetchTransactions to fetch unpaid transactions for debt tracking
const oldFetchTx = `    const { data: recent } = await supabase
      .from("transactions")
      .select("*, materials(name, code)")
      .eq("store", store)
      .eq("type", "OUT")
      .is("deleted_at", null)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order("created_at", { ascending: false });
    if (recent) setTransactions(recent);

    const { data: all } = await supabase`;

const newFetchTx = `    const { data: recent } = await supabase
      .from("transactions")
      .select("*, materials(name, code)")
      .eq("store", store)
      .eq("type", "OUT")
      .is("deleted_at", null)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .order("created_at", { ascending: false });
    if (recent) setTransactions(recent);

    // Fetch ALL unpaid DP transactions for Pelunasan
    const { data: unpaid } = await supabase
      .from("transactions")
      .select("*, materials(name, code)")
      .eq("store", store)
      .eq("type", "OUT")
      .eq("payment_status", "DP")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (unpaid) setUnpaidTransactions(unpaid);

    const { data: all } = await supabase`;

content = content.replace(oldFetchTx, newFetchTx);

// 3. Add unpaidDebts and selectedDebt useMemo right after filteredMaterials
const matchFilteredMat = `  const filteredMaterials = materials.filter(m => `;
const debtsMemo = `  // Group unpaid debts by nota
  const unpaidDebts = useMemo(() => {
    const groups: Record<string, {
      timeKey: string;
      invoiceNo: string;
      created_at: string;
      customer_name: string;
      customer_phone: string;
      items: Transaction[];
      totalAmount: number;
      dpAmount: number;
      remainingDebt: number;
    }> = {};

    unpaidTransactions.forEach((t) => {
      const key = t.created_at;
      if (!groups[key]) {
        groups[key] = {
          timeKey: key,
          invoiceNo: \`KB-\${new Date(key).getTime()}\`,
          created_at: key,
          customer_name: t.customer_name && t.customer_name !== '-' ? t.customer_name : 'Tanpa Nama',
          customer_phone: t.customer_phone || '-',
          items: [],
          totalAmount: 0,
          dpAmount: Number(t.dp_amount) || 0,
          remainingDebt: 0,
        };
      }
      groups[key].items.push(t);
      groups[key].totalAmount += Number(t.total_price || 0);
    });

    return Object.values(groups)
      .map((g) => {
        const dp = Number(g.items[0]?.dp_amount) || 0;
        const sisa = Math.max(0, g.totalAmount - dp);
        return {
          ...g,
          dpAmount: dp,
          remainingDebt: sisa,
        };
      })
      .filter((g) => g.remainingDebt > 0);
  }, [unpaidTransactions]);

  const selectedDebt = useMemo(() => {
    return unpaidDebts.find((d) => d.timeKey === selectedDebtKey) || null;
  }, [unpaidDebts, selectedDebtKey]);

  const filteredMaterials = materials.filter(m => `;

content = content.replace(matchFilteredMat, debtsMemo);

// 4. Add handleProcessPelunasan right before deleteFullNota
const matchDeleteFullNota = `  async function deleteFullNota(items: Transaction[]) {`;
const pelunasanFunc = `  async function handleProcessPelunasan() {
    if (!selectedDebt) return;
    const payVal = Number(pelunasanAmount);
    if (!payVal || payVal <= 0) {
      alert("Masukkan nominal pembayaran!");
      return;
    }
    if (payVal > selectedDebt.remainingDebt) {
      alert(\`Nominal tidak boleh melebihi sisa hutang (Maks: Rp \${selectedDebt.remainingDebt.toLocaleString("id-ID")})\`);
      return;
    }

    setLoading(true);
    const newDp = selectedDebt.dpAmount + payVal;
    const isFullLunas = newDp >= selectedDebt.totalAmount;
    const newStatus = isFullLunas ? "LUNAS" : "DP";

    const ids = selectedDebt.items.map(i => i.id);
    const { error } = await supabase
      .from("transactions")
      .update({
        dp_amount: newDp,
        payment_status: newStatus
      })
      .in("id", ids);

    if (error) {
      alert("Gagal memproses pelunasan: " + error.message);
      setLoading(false);
      return;
    }

    showToast(isFullLunas ? "Pelunasan berhasil! Hutang sudah LUNAS." : \`Pembayaran cicilan Rp \${payVal.toLocaleString("id-ID")} berhasil dicatat!\`, "success");

    // Sync to Google Sheets
    try {
      const year = new Date(selectedDebt.created_at).getFullYear().toString();
      fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pelunasan',
          payload: {
            invoiceNo: selectedDebt.invoiceNo,
            total: selectedDebt.totalAmount,
            dp: newDp,
            sisa: Math.max(0, selectedDebt.totalAmount - newDp),
            status: newStatus
          },
          year
        })
      }).catch(console.error);
    } catch (e) {
      console.error(e);
    }

    // Set receipt data for proof of payment
    setReceiptData({
      invoiceNo: selectedDebt.invoiceNo,
      date: new Date(),
      items: selectedDebt.items.map(t => {
        const mat = materials.find(m => m.id === t.material_id) || {
          id: t.material_id,
          name: t.materials?.name || "-",
          price: t.total_price / t.quantity,
          cost_price: t.cost_price,
          store: activeStore,
          current_stock: 0
        };
        return {
          material: mat,
          quantity: t.quantity,
          subtotal: t.total_price,
          display_quantity: t.quantity,
          display_unit: 'Pcs',
          display_price: Math.round(t.total_price / t.quantity),
          pack_multiplier: 1
        };
      }),
      total: selectedDebt.totalAmount,
      customerName: selectedDebt.customer_name,
      customerPhone: selectedDebt.customer_phone,
      paymentStatus: newStatus,
      dpAmount: newDp
    });

    setSelectedDebtKey("");
    setPelunasanAmount("");
    setLoading(false);
    fetchData(activeStore);
  }

  async function deleteFullNota(items: Transaction[]) {`;

content = content.replace(matchDeleteFullNota, pelunasanFunc);

// 5. Update handleCheckout to properly send customer and DP fields
const oldCheckoutFuncRegex = /async function handleCheckout\(\) \{[\s\S]*?showToast\("Gagal menyimpan transaksi", "error"\);\s*\}\s*\}/;

const newCheckoutFunc = `async function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);

    const now = new Date();
    const invoiceNo = \`KB-\${now.getTime()}\`;

    const isDp = paymentMode === "DP";
    const dpNum = isDp ? (Number(dpAmount) || 0) : cartTotal;

    const insertData = cart.map(item => ({
      material_id: item.material.id,
      type: 'OUT' as const,
      quantity: item.quantity,
      cost_price: item.material.cost_price,
      total_price: item.subtotal,
      store: activeStore,
      created_at: now.toISOString(),
      customer_name: customerName.trim() || "-",
      customer_phone: customerPhone.trim() || "-",
      payment_status: isDp ? "DP" : "LUNAS",
      dp_amount: dpNum
    }));

    const { data: insertedData, error } = await supabase.from("transactions").insert(insertData).select('id');

    setLoading(false);
    if (!error) {
      // Sync to Google Sheets
      if (insertedData) {
        try {
          const year = now.getFullYear().toString();
          const notaItemsText = cart.map(item => \`\${item.display_quantity} \${item.display_unit} \${displayMaterialName(item.material.name).replace(/-\\s*\\[.*?\\]$/, '').trim()}\`).join(', ');
          const grandTotal = cartTotal;
          const sisaValue = Math.max(0, grandTotal - dpNum);
          
          const sheetPayload = [[
            invoiceNo,
            format(now, "yyyy-MM-dd"),
            format(now, "HH:mm"),
            activeStore === 'karya_bahan' ? 'Karya Bahan' : 'Bysca',
            'JUAL (OUT) - NOTA',
            notaItemsText,
            '1 Nota',
            grandTotal,
            '? VALID',
            customerName.trim() || '-',
            customerPhone.trim() || '-',
            isDp ? "DP" : "LUNAS",
            dpNum,
            sisaValue
          ]];
          fetch('/api/sheets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkout', payload: sheetPayload, year })
          }).then(res => res.json()).then(data => {
            console.log('Sheets Sync Checkout:', data);
            if (data.error) alert('Gagal Sinkronisasi Google Sheets: ' + data.error);
          }).catch(console.error);
        } catch (e) {
          console.error(e);
        }
      }

      showToast("Transaksi berhasil disimpan", "success");
      setReceiptData({
        invoiceNo,
        date: now,
        items: [...cart],
        total: cartTotal,
        customerName: customerName.trim() || "-",
        customerPhone: customerPhone.trim() || "-",
        paymentStatus: isDp ? "DP" : "LUNAS",
        dpAmount: dpNum
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMode("LUNAS");
      setDpAmount("");
      fetchData(activeStore);
    } else {
      console.error(error);
      showToast("Gagal menyimpan transaksi: " + error.message, "error");
    }
  }`;

content = content.replace(oldCheckoutFuncRegex, newCheckoutFunc);

// 6. Replace Checkout Panel UI (Customer details, radio buttons, Grand Total, Checkout button, Pelunasan interface)
const oldPanelRegex = /<div className="bg-gray-100 p-4 border-t-2 border-black">\s*\{\/\* Customer Details \*\/\}[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

const newPanel = `<div className="bg-gray-100 p-4 border-t-2 border-black">
                {/* 3 Payment Modes */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase mb-2 text-gray-700">PILIH STATUS / METODE TRANSAKSI:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('LUNAS')}
                      className={\`p-3 font-bold text-xs uppercase border-2 border-black rounded transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 \${paymentMode === 'LUNAS' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200'}\`}
                    >
                      <span>? LUNAS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('DP')}
                      className={\`p-3 font-bold text-xs uppercase border-2 border-black rounded transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 \${paymentMode === 'DP' ? 'bg-amber-400 text-black border-black' : 'bg-white text-black hover:bg-gray-200'}\`}
                    >
                      <span>? DP / NYICIL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('PELUNASAN')}
                      className={\`p-3 font-bold text-xs uppercase border-2 border-black rounded transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 relative \${paymentMode === 'PELUNASAN' ? 'bg-green-600 text-white border-black' : 'bg-white text-black hover:bg-gray-200'}\`}
                    >
                      <span>?? PELUNASAN</span>
                      {unpaidDebts.length > 0 && (
                        <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 animate-pulse">
                          {unpaidDebts.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* If Mode is PELUNASAN */}
                {paymentMode === 'PELUNASAN' ? (
                  <div className="space-y-4 border-t-2 border-black pt-4 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold uppercase mb-1 text-gray-800">
                        PILIH NAMA PEMILIK HUTANG:
                      </label>
                      {unpaidDebts.length === 0 ? (
                        <div className="p-4 bg-green-50 border-2 border-green-600 text-green-900 rounded font-bold text-center text-sm">
                          ?? Semua tagihan hutang sudah lunas! Tidak ada customer yang punya sisa hutang saat ini.
                        </div>
                      ) : (
                        <select
                          value={selectedDebtKey}
                          onChange={(e) => {
                            setSelectedDebtKey(e.target.value);
                            setPelunasanAmount("");
                          }}
                          className="w-full p-3 border-2 border-black bg-white font-bold text-sm focus:outline-none focus:ring-4 focus:ring-green-300"
                        >
                          <option value="">-- PILIH NAMA CUSTOMER (\${unpaidDebts.length} BELUM LUNAS) --</option>
                          {unpaidDebts.map((d) => (
                            <option key={d.timeKey} value={d.timeKey}>
                              ?? \${d.customer_name} | Sisa Hutang: Rp \${d.remainingDebt.toLocaleString('id-ID')} (\${format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedDebt && (
                      <div className="bg-white border-2 border-green-700 p-4 shadow-[4px_4px_0_0_#000] space-y-3 animate-fade-in">
                        <div className="flex justify-between items-start border-b border-gray-300 pb-2">
                          <div>
                            <span className="text-xs text-gray-500 font-bold uppercase">Nama Customer:</span>
                            <div className="text-lg font-black text-black">?? \${selectedDebt.customer_name}</div>
                            {selectedDebt.customer_phone !== '-' && (
                              <div className="text-xs text-gray-600 font-mono">Telp: \${selectedDebt.customer_phone}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500 font-bold uppercase">Waktu Nota:</span>
                            <div className="text-xs font-mono font-bold text-gray-700">
                              \${format(new Date(selectedDebt.created_at), 'dd MMM yyyy HH:mm')}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 bg-gray-50 p-2 border border-gray-200">
                          <span className="font-bold">Barang di Nota: </span>
                          \${selectedDebt.items.map(i => \`\${i.quantity}x \${displayMaterialName(i.materials?.name)}\`).join(', ')}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-gray-300 pb-2">
                          <div>
                            <span className="text-gray-500">Total Belanja:</span>
                            <div className="font-bold font-mono text-sm">Rp \${selectedDebt.totalAmount.toLocaleString('id-ID')}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Sudah Dibayar (DP):</span>
                            <div className="font-bold font-mono text-sm text-blue-700">Rp \${selectedDebt.dpAmount.toLocaleString('id-ID')}</div>
                          </div>
                        </div>

                        <div className="bg-red-50 border border-red-300 p-3 rounded flex justify-between items-center">
                          <span className="font-bold text-xs uppercase text-red-700">SISA HUTANG SAAT INI:</span>
                          <span className="font-mono text-2xl font-black text-red-600">
                            Rp \${selectedDebt.remainingDebt.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold uppercase text-green-900">
                              Nominal Yang Dibayarkan (Rp):
                            </label>
                            <button
                              type="button"
                              onClick={() => setPelunasanAmount(String(selectedDebt.remainingDebt))}
                              className="text-xs bg-green-700 hover:bg-green-800 text-white px-2.5 py-1 font-bold rounded shadow-sm transition-colors"
                            >
                              ? LUNAS SEMUA (Rp \${selectedDebt.remainingDebt.toLocaleString('id-ID')})
                            </button>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max={selectedDebt.remainingDebt}
                            className="w-full p-3 border-2 border-green-600 font-mono text-2xl font-black bg-white focus:outline-none focus:ring-4 focus:ring-green-200"
                            value={pelunasanAmount}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val > selectedDebt.remainingDebt) {
                                setPelunasanAmount(String(selectedDebt.remainingDebt));
                              } else {
                                setPelunasanAmount(e.target.value.replace(/^0+(?=\\d)/, ''));
                              }
                            }}
                            placeholder="Ketik nominal uang..."
                          />
                          <p className="text-[11px] text-gray-500 mt-1">
                            *Nominal tidak bisa melebihi sisa hutang (Maksimal: Rp \${selectedDebt.remainingDebt.toLocaleString('id-ID')})
                          </p>

                          {Number(pelunasanAmount) === selectedDebt.remainingDebt && (
                            <div className="mt-2 text-xs bg-green-100 border border-green-500 text-green-800 p-2 font-bold rounded text-center">
                              ? Akan LUNAS PENUH! Nama customer ini akan otomatis hilang dari daftar hutang setelah diproses.
                            </div>
                          )}

                          {Number(pelunasanAmount) > 0 && Number(pelunasanAmount) < selectedDebt.remainingDebt && (
                            <div className="mt-2 text-xs bg-amber-100 border border-amber-500 text-amber-900 p-2 font-bold rounded text-center">
                              ? Pembayaran cicilan sebesar Rp \${Number(pelunasanAmount).toLocaleString('id-ID')}. Sisa hutang berikutnya menjadi: Rp \${(selectedDebt.remainingDebt - Number(pelunasanAmount)).toLocaleString('id-ID')}.
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleProcessPelunasan}
                          disabled={loading || !pelunasanAmount || Number(pelunasanAmount) <= 0}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white p-4 font-bold text-base uppercase tracking-wider transition-all flex justify-center items-center gap-2 shadow-[4px_4px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                        >
                          {loading ? "MEMPROSES..." : "PROSES PEMBAYARAN PELUNASAN"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard Checkout Area (LUNAS or DP) */
                  <>
                    <div className="mb-4 grid grid-cols-2 gap-4 border-b border-gray-300 pb-4">
                      <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-700">Nama Customer (Opsional)</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                          placeholder="Mis: PAK BUDI"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-700">No. Telp (Opsional)</label>
                        <input
                          type="text"
                          className="w-full p-2 border border-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Mis: 0812..."
                        />
                      </div>

                      {paymentMode === 'DP' && (
                        <div className="col-span-2 animate-fade-in mt-1">
                          <label className="block text-xs font-bold uppercase mb-1 text-amber-900">
                            Nominal DP Yang Dibayar Saat Ini (Rp):
                          </label>
                          <input
                            type="number"
                            className="w-full p-3 border-2 border-amber-600 bg-white font-mono text-xl font-bold focus:outline-none focus:ring-4 focus:ring-amber-200 transition-all"
                            value={dpAmount}
                            onChange={(e) => setDpAmount(e.target.value.replace(/^0+(?=\\d)/, ''))}
                            placeholder="Ketik nominal uang muka (DP)..."
                          />
                          {Number(dpAmount) > 0 && cartTotal > 0 && (
                            <div className="text-xs text-red-600 font-bold mt-1">
                              Sisa Hutang Yang Belum Dibayar: Rp \${Math.max(0, cartTotal - Number(dpAmount)).toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xl font-bold uppercase tracking-wider">Grand Total</span>
                      <span className="text-3xl font-mono font-bold text-green-700">
                        Rp <AnimatedNumber value={cartTotal} />
                      </span>
                    </div>

                    <button
                      onClick={handleCheckout}
                      disabled={loading || cart.length === 0}
                      className="w-full bg-black text-white p-4 font-bold text-lg uppercase tracking-wider hover:bg-gray-800 disabled:bg-gray-400 transition-swiss hover-elevate active-press flex justify-center items-center gap-2"
                    >
                      {loading ? "PROCESSING..." : (paymentMode === 'DP' ? "SIMPAN TRANSAKSI DP" : "BAYAR / CHECKOUT")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>`;

content = content.replace(oldPanelRegex, newPanel);

// 7. Update Nota in Recent Transactions to display customer name if available
const oldNotaBadge = `<span className="text-sm">{format(new Date(time), "HH:mm")}</span>`;
const newNotaBadge = `<span className="text-sm">{format(new Date(time), "HH:mm")}</span>
                              {items[0]?.customer_name && items[0]?.customer_name !== '-' && (
                                <span className="bg-blue-600 text-white px-2 py-0.5 text-xs font-bold rounded">
                                  ?? {items[0].customer_name}
                                </span>
                              )}`;
content = content.replace(oldNotaBadge, newNotaBadge);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Successfully updated page.tsx with full Pelunasan feature!");
