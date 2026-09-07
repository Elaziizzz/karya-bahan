const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// Add createPortal
if (!content.includes("createPortal")) {
  content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";');
}

// Find {isModalOpen && ( ... )}
// It ends with: 
//                     </button>
//                   </div>
//                 </form>
//               </div>
//             </div>
//           )}

const searchRegex = /\{\/\* --- MANUAL ADD \/ EDIT MODAL --- \*\/\}[\s\S]*?\{\/\* --- INVENTORY TABLE --- \*\/\}/;
const match = content.match(searchRegex);
if (match) {
  let modalBlock = match[0]; // Includes {isModalOpen && ( <div...> ... </div> )}
  
  // Replace `{isModalOpen && (` with `{isModalOpen && typeof document !== 'undefined' ? createPortal(`
  // Replace exactly `          )}` with `          ), document.body) : null}`
  
  // Actually, string replacement on the exact block:
  let newModalBlock = modalBlock.replace(
    /\{isModalOpen && \(/,
    "{isModalOpen && typeof document !== 'undefined' ? createPortal("
  );
  
  // find the last `)}` before `{/* --- INVENTORY TABLE`
  newModalBlock = newModalBlock.replace(
    /\)\}\s*\{\/\* --- INVENTORY TABLE --- \*\/\}/,
    "), document.body) : null}\n\n        {/* --- INVENTORY TABLE --- */}"
  );
  
  content = content.replace(modalBlock, newModalBlock);
  fs.writeFileSync("src/app/materials/page.tsx", content);
  console.log("Portal injected correctly.");
} else {
  console.log("Could not find modal block.");
}
