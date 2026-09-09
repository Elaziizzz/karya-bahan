const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Update Receipt Type
const oldReceiptType = `  const [receiptData, setReceiptData] = useState<{
    invoiceNo: string;
    date: Date;
    items: CartItem[];
    total: number;
  } | null>(null);`;
const newReceiptType = `  const [receiptData, setReceiptData] = useState<{
    invoiceNo: string;
    date: Date;
    items: CartItem[];
    total: number;
    customerName: string;
    customerPhone: string;
    paymentStatus: string;
    dpAmount: number;
  } | null>(null);`;
content = content.replace(oldReceiptType, newReceiptType);

// 2. Update insertData mapping
const oldInsertData = `    const insertData = cart.map(item => ({
      material_id: item.material.id,
      type: 'OUT',
      quantity: item.quantity,
      cost_price: item.material.cost_price,
      total_price: item.subtotal,
      store: activeStore,
      created_at: now.toISOString()
    }));`;
const newInsertData = `    const insertData = cart.map(item => ({
      material_id: item.material.id,
      type: 'OUT',
      quantity: item.quantity,
      cost_price: item.material.cost_price,
      total_price: item.subtotal,
      store: activeStore,
      created_at: now.toISOString(),
      customer_name: customerName || "-",
      customer_phone: customerPhone || "-",
      payment_status: paymentStatus,
      dp_amount: paymentStatus === 'DP' ? (Number(dpAmount) || 0) : 0
    }));`;
content = content.replace(oldInsertData, newInsertData);

// 3. Update setReceiptData call in checkout
const oldSetReceipt = `      setReceiptData({
        invoiceNo,
        date: now,
        items: [...cart],
        total: cartTotal
      });
      setCart([]);`;
const newSetReceipt = `      setReceiptData({
        invoiceNo,
        date: now,
        items: [...cart],
        total: cartTotal,
        customerName: customerName || "-",
        customerPhone: customerPhone || "-",
        paymentStatus,
        dpAmount: paymentStatus === 'DP' ? (Number(dpAmount) || 0) : cartTotal
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentStatus("LUNAS");
      setDpAmount("");`;
content = content.replace(oldSetReceipt, newSetReceipt);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Patched checkout logic.");
