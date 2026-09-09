const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// 1. Update Receipt Type using Regex
const typeRegex = /const \[receiptData, setReceiptData\] = useState<\s*\{\s*invoiceNo: string;\s*date: Date;\s*items: CartItem\[\];\s*total: number;\s*\}\s*\|\s*null>\(null\);/g;

const newType = `const [receiptData, setReceiptData] = useState<{
    invoiceNo: string;
    date: Date;
    items: CartItem[];
    total: number;
    customerName: string;
    customerPhone: string;
    paymentStatus: string;
    dpAmount: number;
  } | null>(null);`;

content = content.replace(typeRegex, newType);

// 2. Update setReceiptData inside checkout using Regex
const setReceiptRegex = /setReceiptData\(\{\s*invoiceNo,\s*date:\s*now,\s*items:\s*\[\.\.\.cart\],\s*total:\s*cartTotal\s*\}\);/g;

const newSetReceipt = `setReceiptData({
          invoiceNo,
          date: now,
          items: [...cart],
          total: cartTotal,
          customerName: customerName || "-",
          customerPhone: customerPhone || "-",
          paymentStatus,
          dpAmount: paymentStatus === 'DP' ? (Number(dpAmount) || 0) : cartTotal
        });`;

content = content.replace(setReceiptRegex, newSetReceipt);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Patched receipt type and call.");
