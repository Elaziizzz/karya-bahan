const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

// Remove the duplicated block: from line 122 to line 161
const duplicateChunk = `  async function fetchData(store: string) {
    await fetchMaterials(store);
    await fetchTransactions(store);
  }
  } | null>(null);

  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData("karya_bahan");

    const materialSubscription = supabase
      .channel("public:materials")
      .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, () => {
        fetchMaterials("karya_bahan");
      })
      .subscribe();

    const transactionSubscription = supabase
      .channel("public:transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions("karya_bahan");
      })
      .subscribe();



    return () => {
      supabase.removeChannel(materialSubscription);
      supabase.removeChannel(transactionSubscription);
    };
  }, []);



  async function fetchData(store: string) {
    await fetchMaterials(store);
    await fetchTransactions(store);
  }`;

content = content.replace(duplicateChunk, `  async function fetchData(store: string) {
    await fetchMaterials(store);
    await fetchTransactions(store);
  }`);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Cleaned up duplicate chunk!");
