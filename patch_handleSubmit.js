const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// We need to inject the investor appending logic into handleSubmit
// Find:
//      let finalName = formData.name;
//      if (formData.hasPack && formData.packName && formData.packMultiplier) {
//        finalName = `${formData.name} - [1 ${formData.packName} = ${formData.packMultiplier} ${formData.baseUnit}]`;
//      } else if (formData.baseUnit && formData.baseUnit !== 'Pcs') {
//        finalName = `${formData.name} - [${formData.baseUnit}]`;
//      }
// And append investor logic after it.

const startIndex = content.indexOf("let finalName = formData.name;");
if (startIndex !== -1) {
  const endBlock = content.indexOf("if (editingId) {", startIndex);
  const block = content.substring(startIndex, endBlock);
  
  if (!block.includes("formData.investor")) {
    const newBlock = block.trimRight() + `\n      if (formData.investor && formData.investor.trim() !== '') {\n        finalName += \` = (\${formData.investor.trim().toUpperCase()})\`;\n      }\n\n      `;
    content = content.substring(0, startIndex) + newBlock + content.substring(endBlock);
    fs.writeFileSync("src/app/materials/page.tsx", content);
    console.log("handleSubmit patched to append investor.");
  } else {
    console.log("handleSubmit already has investor logic.");
  }
} else {
  console.log("Could not find let finalName = formData.name;");
}
