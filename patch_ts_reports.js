const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

// 1. Add selectedInvestor state
content = content.replace(
  'const [customMonth, setCustomMonth] = useState<string>("");',
  'const [customMonth, setCustomMonth] = useState<string>("");\n  const [selectedInvestor, setSelectedInvestor] = useState<string>("Semua");'
);

// 2. Fix generateSheet signature in exportExcel
// generateSheet was expecting Transaction[][], but we pass filteredTransactions which is Transaction[]. Wait!
// If we pass filteredTransactions, we must group them inside generateSheet, OR pass groupedTransactions!
content = content.replace(
  'generateSheet("Semua Transaksi", filteredTransactions);',
  'generateSheet("Semua Transaksi", groupedTransactions);'
);
content = content.replace(
  /generateSheet\(\`Laporan \$\{inv\}\`, invTxs\);/g,
  'generateSheet(`Laporan ${inv}`, invTxs);'
);
content = content.replace(
  /generateSheet\(selectedInvestor === "Semua" \? "Laporan PnL" : \`Laporan \$\{selectedInvestor\}\`, filteredTransactions\);/g,
  'generateSheet(selectedInvestor === "Semua" ? "Laporan PnL" : `Laporan ${selectedInvestor}`, groupedTransactions);'
);
content = content.replace(
  /const invTxs = filteredTransactions\.map\(group => \{/g,
  'const invTxs = groupedTransactions.map(group => {'
);


// 3. Fix filteredTransactions to filter by selectedInvestor
// We need to filter `allTransactions` BEFORE it returns.
const oldFilteredTransactions = /if \(selectedFilter === "CUSTOM_MONTH" && customMonth\) \{\s*return allTransactions\.filter\(t => format\(\(t\.created_at \? new Date\(t\.created_at\) : new Date\(0\)\), "yyyy-MM"\) === customMonth\);\s*\}\s*return allTransactions;\s*\}, \[allTransactions, selectedFilter, customDate, customMonth\]\);/;

const newFilteredTransactions = `let result = allTransactions;
    if (selectedFilter === "TODAY") result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"));
    else if (selectedFilter === "YESTERDAY") {
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"));
    }
    else if (selectedFilter === "THIS_MONTH") result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === format(today, "yyyy-MM"));
    else if (selectedFilter === "CUSTOM_DATE" && customDate) result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === customDate);
    else if (selectedFilter === "CUSTOM_MONTH" && customMonth) result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === customMonth);

    if (selectedInvestor !== "Semua") {
      result = result.filter(t => {
        const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
        return im && im[1].trim() === selectedInvestor;
      });
    }

    return result;
  }, [allTransactions, selectedFilter, customDate, customMonth, selectedInvestor]);`;

// But the original code was:
const startFiltered = content.indexOf('const filteredTransactions = useMemo(() => {');
const endFiltered = content.indexOf('}, [allTransactions, selectedFilter, customDate, customMonth]);') + '}, [allTransactions, selectedFilter, customDate, customMonth]);'.length;

content = content.substring(0, startFiltered) + `const filteredTransactions = useMemo(() => {
    const today = new Date();
    let result = allTransactions;

    if (selectedFilter === "TODAY") {
      result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"));
    } else if (selectedFilter === "YESTERDAY") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"));
    } else if (selectedFilter === "THIS_MONTH") {
      result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === format(today, "yyyy-MM"));
    } else if (selectedFilter === "CUSTOM_DATE" && customDate) {
      result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM-dd") === customDate);
    } else if (selectedFilter === "CUSTOM_MONTH" && customMonth) {
      result = allTransactions.filter(t => format((t.created_at ? new Date(t.created_at) : new Date(0)), "yyyy-MM") === customMonth);
    }

    if (selectedInvestor !== "Semua") {
      result = result.filter(t => {
        const im = t.materials?.name?.match(/\\s*=\\s*\\((.*?)\\)$/);
        return im && im[1].trim() === selectedInvestor;
      });
    }

    return result;
  }, [allTransactions, selectedFilter, customDate, customMonth, selectedInvestor]);` + content.substring(endFiltered);

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Reports TS fixed.");
