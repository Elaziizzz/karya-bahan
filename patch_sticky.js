const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// Make the top action bar sticky
const oldBar = /<div className="flex flex-wrap gap-4">/;
const newBar = `<div className="flex flex-wrap gap-4 sticky top-0 z-40 bg-[#f4f4f4] pt-4 pb-4 border-b-2 border-black -mx-4 px-4 shadow-sm">`;

// Check if we already have some sticky styling there
if (content.includes("sticky top-0 z-40")) {
  console.log("Already sticky");
} else {
  content = content.replace(oldBar, newBar);
  
  // Also we need to make sure the main container doesn't hide it or mess it up.
  // The layout is usually: <div className="p-4 md:p-8 ... pb-32">
  // We can just add sticky to the header wrapping both title and search bar.
  
  const oldHeaderArea = /<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-black pb-4">/;
  const newHeaderArea = `<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-black pb-4 sticky top-0 z-40 bg-[#f4f4f4] pt-4 -mx-4 px-4 shadow-sm">`;
  content = content.replace(oldHeaderArea, newHeaderArea);
}

fs.writeFileSync("src/app/materials/page.tsx", content);
