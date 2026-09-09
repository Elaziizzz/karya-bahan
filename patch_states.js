const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

const statesInject = `
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"LUNAS" | "DP">("LUNAS");
  const [dpAmount, setDpAmount] = useState("");
`;

content = content.replace(
  'const [cart, setCart] = useState<CartItem[]>([]);',
  'const [cart, setCart] = useState<CartItem[]>([]);\n' + statesInject
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Injected new states for DP and Customer.");
