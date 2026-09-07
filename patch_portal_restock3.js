const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

if (!content.includes("createPortal")) {
  content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";');
}

const searchRegex = /\{\/\* Edit Restock Transaction Modal \*\/\}[\s\S]*?\{editingTx && \([\s\S]*?\}\s*\)\}/;
const match = content.match(searchRegex);
if (match) {
  let modalBlock = match[0];
  
  let newModalBlock = modalBlock.replace(
    /\{editingTx && \(/,
    "{editingTx && typeof document !== 'undefined' ? createPortal("
  );
  
  newModalBlock = newModalBlock.replace(
    /\)\}\s*$/,
    "), document.body) : null}"
  );
  
  content = content.replace(modalBlock, newModalBlock);
  fs.writeFileSync("src/app/restock/page.tsx", content);
  console.log("Restock Portal injected correctly.");
} else {
  console.log("Could not find modal block.");
}
