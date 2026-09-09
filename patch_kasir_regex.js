const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

content = content.replace(
  /\/-\\s\*\\\[1\\s\+\(\[\^=\]\+\?\)\\s\*=\\s\*\(\\d\+\)\\s\+\(\[\^@\\\]\]\+\?\)\(\?:\\s\*@\\s\*\(\\d\+\)\)\?\\\]\$\//g,
  "/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^@\\]]+?)(?:\\s*@\\s*(\\d+))?\\](?:\\s*=\\s*\\((.*?)\\))?$/"
);

content = content.replace(
  /\/-\\s\*\\\[\(\[\^=\\\]\]\+\?\)\\\]\$\//g,
  "/-\\s*\\[([^=\\]]+?)\\](?:\\s*=\\s*\\((.*?)\\))?$/"
);

content = content.replace(
  /\/-\\s\*\\\[1\\s\+\(\[\^=\]\+\?\)\\s\*=\\s\*\(\\d\+\)\\s\+\(\[\^\\\]\]\+\?\)\\\]\$\//g,
  "/-\\s*\\[1\\s+([^=]+?)\\s*=\\s*(\\d+)\\s+([^\\]]+?)\\](?:\\s*=\\s*\\((.*?)\\))?$/"
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Kasir regex patched.");
