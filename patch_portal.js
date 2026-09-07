const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// Add createPortal import
if (!content.includes("createPortal")) {
  content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";');
}

// Find the modal block at the top
const modalRegex = /\{\/\* --- MANUAL ADD \/ EDIT MODAL --- \*\/\}[\s\S]*?\{isModalOpen && \([\s\S]*?\}\)[\s\S]*?<\/div>\s*\)\}/;

const match = content.match(modalRegex);
if (match) {
  let modalContent = match[0];
  
  // Wrap it in a portal check
  const portalCode = `
        {/* --- MANUAL ADD / EDIT MODAL --- */}
        {isModalOpen && typeof document !== 'undefined' ? createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center p-4 z-50 overflow-y-auto py-12">
${modalContent.split('<div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center p-4 z-50 overflow-y-auto py-12">')[1].replace(/}$/, '')},
          document.body
        ) : null}
`;

  // Actually, string replacement can be tricky. Let's do it precisely.
  content = content.replace(modalContent, portalCode);

  fs.writeFileSync("src/app/materials/page.tsx", content);
  console.log("Portal injected!");
} else {
  console.log("Modal not found for portal injection.");
}
