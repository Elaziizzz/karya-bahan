import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set in environment variables." }, { status: 500 });
    }

    const formData = await req.formData();
    const action = formData.get("action");

    if (action === "MAP_COLUMNS") {
      const headers = formData.get("headers") as string;
      const sampleRows = formData.get("sampleRows") as string;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

      const prompt = `
        You are an AI data mapper for an inventory system.
        I will provide you with the headers and a few sample rows of an uploaded Excel/CSV file.
        Your task is to map the provided headers to the following standard system keys:
        - "code" (Kode Barang, SKU, Product Code)
        - "name" (Nama Barang, Produk, Item)
        - "stock" (Qty, Jumlah, Stok, Stock, Persediaan)
        - "cost_price" (Harga Modal, Harga Beli, Modal, Purchase Price)
        - "price" (Harga Jual, Harga Retail, Selling Price)

        Rules:
        1. Look at the headers and sample rows to infer meaning.
        2. Respond ONLY with a valid JSON object.
        3. The JSON object should have the standard system keys as the JSON keys, and the exact string of the provided header as the value.
        4. If a standard key cannot be confidently mapped, do not include it in the JSON response, or set its value to null.

        Uploaded Headers: ${headers}
        Sample Rows: ${sampleRows}
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Attempt to parse just to be safe
      return NextResponse.json(JSON.parse(text));
    } 
    
    else if (action === "OCR_IMAGE") {
      const imageFile = formData.get("image") as File;
      if (!imageFile) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }

      // Convert image to generative part format
      const buffer = await imageFile.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString("base64");
      
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: imageFile.type
        }
      };

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", generationConfig: { responseMimeType: "application/json" } });

      const prompt = `
        Extract the tabular inventory data from this image.
        Return the data as a JSON array of objects.
        Each object MUST have the following keys (even if the value is empty or 0, provide the key):
        - "code" (string, the product code/SKU)
        - "name" (string, the product name)
        - "stock" (number, the quantity)
        - "cost_price" (number, the cost/purchase price)
        - "price" (number, the selling price)

        Rules:
        1. If you cannot find a specific column, leave the value as null or 0.
        2. Maintain the exact product code if visible.
        3. Remove any currency symbols (Rp, $, etc) and separators from prices, return them as pure numbers.
        4. Return ONLY the JSON array.
      `;

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      let text = response.text();

      return NextResponse.json(JSON.parse(text));
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("AI Import Error:", error);
    return NextResponse.json({ error: error.message || "An error occurred during AI processing" }, { status: 500 });
  }
}
