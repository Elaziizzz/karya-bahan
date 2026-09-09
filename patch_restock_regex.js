const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

content = content.replace(
  /\/-\\s\*\\\[1\\s\+\(\[\^=\]\+\?\)\\s\*=\\s\*\(\\d\+\)\\s\+\(\[\^\\\]\]\+\?\)\\\]\$\//g,
  "/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^\\]]+?)\\](?:\\s*=\\s*\\((.*?)\\))?$/"
);

content = content.replace(
  /\/-\\s\*\\\[\(\[\^=\\\]\]\+\?\)\\\]\$\//g,
  "/-\\s*\\[([^=\\]]+?)\\](?:\\s*=\\s*\\((.*?)\\))?$/"
);

fs.writeFileSync("src/app/restock/page.tsx", content);
console.log("Restock regex patched.");
