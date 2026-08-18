"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { UploadCloud, Zap, FileSpreadsheet, Image as ImageIcon, CheckCircle, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";

type ImportRow = {
  id: string; // temp id
  code: string;
  name: string;
  stock: number;
  cost_price: number;
  price: number;
  status: 'valid' | 'warning' | 'error';
  statusMessage?: string;
  conflictData?: any; // existing material from DB
  resolution?: 'tambah_stok' | 'set_stok' | 'skip';
};

export default function SmartImportPage() {
  const [activeStore] = useState("karya_bahan");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    newItems: number;
    updatedItems: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setLoadingStep("Membaca file...");
    setPreviewData([]);
    setShowPreview(false);
    setImportResult(null);

    try {
      const fileType = file.name.split('.').pop()?.toLowerCase();
      
      let extractedData: any[] = [];

      if (['jpg', 'jpeg', 'png'].includes(fileType || '')) {
        // IMAGE OCR
        setLoadingStep("AI sedang membaca tabel dari gambar...");
        const formData = new FormData();
        formData.append("action", "OCR_IMAGE");
        formData.append("image", file);

        const response = await fetch("/api/ai-import", { method: "POST", body: formData });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || "Gagal memproses gambar");
        extractedData = data;

      } else if (['xlsx', 'xls', 'csv'].includes(fileType || '')) {
        // EXCEL / CSV MAPPING
        setLoadingStep("Mengekstrak data tabel...");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        if (rawData.length < 2) throw new Error("File kosong atau tidak memiliki baris data");

        // Assuming first row is header
        const headers = rawData[0];
        const sampleRows = rawData.slice(1, 5); // Take up to 4 rows for sample

        setLoadingStep("AI sedang memetakan kolom secara otomatis...");
        const formData = new FormData();
        formData.append("action", "MAP_COLUMNS");
        formData.append("headers", JSON.stringify(headers));
        formData.append("sampleRows", JSON.stringify(sampleRows));

        const response = await fetch("/api/ai-import", { method: "POST", body: formData });
        const mapping = await response.json();

        if (!response.ok) throw new Error(mapping.error || "Gagal memetakan kolom");
        if (Object.keys(mapping).length === 0) throw new Error("AI tidak bisa memahami struktur kolom file ini");

        // Map the rest of the data using AI's mapping
        setLoadingStep("Memproses ribuan baris data...");
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          let rowObj: any = {};
          // Map array back to object using original headers
          headers.forEach((h, idx) => {
            rowObj[h] = row[idx];
          });

          let mappedRow: any = { code: "", name: "", stock: 0, cost_price: 0, price: 0 };
          
          // Apply AI Mapping
          if (mapping.code) mappedRow.code = String(rowObj[mapping.code] || "");
          if (mapping.name) mappedRow.name = String(rowObj[mapping.name] || "");
          if (mapping.stock) mappedRow.stock = Number(rowObj[mapping.stock]) || 0;
          if (mapping.cost_price) mappedRow.cost_price = Number(rowObj[mapping.cost_price]) || 0;
          if (mapping.price) mappedRow.price = Number(rowObj[mapping.price]) || 0;

          if (mappedRow.name || mappedRow.code) {
             extractedData.push(mappedRow);
          }
        }
      } else {
        throw new Error("Format file tidak didukung. Gunakan Excel, CSV, atau Gambar JPG/PNG.");
      }

      await validateAndCheckConflicts(extractedData);

    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateAndCheckConflicts = async (data: any[]) => {
    setLoadingStep("Memvalidasi dan mengecek konflik di database...");
    
    // Fetch all existing materials for quick lookup
    const { data: existingMaterials, error } = await supabase
      .from("materials")
      .select("*")
      .eq("store", activeStore);

    if (error) throw new Error("Gagal mengambil data dari database");

    const processedData: ImportRow[] = data.map((item, index) => {
      let status: 'valid' | 'warning' | 'error' = 'valid';
      let statusMessage = '';
      let resolution: 'tambah_stok' | 'set_stok' | 'skip' = 'tambah_stok';

      if (!item.name && !item.code) {
        status = 'error';
        statusMessage = 'Nama dan Kode barang kosong';
      }

      // Conflict Check
      let conflict = null;
      if (item.code) {
        conflict = existingMaterials.find(m => m.code?.toLowerCase() === item.code.toLowerCase());
      }
      if (!conflict && item.name) {
        conflict = existingMaterials.find(m => m.name.toLowerCase() === item.name.toLowerCase());
      }

      if (conflict) {
        status = 'warning';
        statusMessage = `Barang sudah ada (Stok DB: ${conflict.current_stock})`;
      }

      return {
        id: `temp-${index}`,
        code: item.code || "",
        name: item.name || "",
        stock: item.stock || 0,
        cost_price: item.cost_price || 0,
        price: item.price || 0,
        status,
        statusMessage,
        conflictData: conflict,
        resolution: conflict ? 'tambah_stok' : undefined
      };
    });

    setPreviewData(processedData);
    setShowPreview(true);
  };

  const updateResolution = (id: string, res: 'tambah_stok' | 'set_stok' | 'skip') => {
    setPreviewData(prev => prev.map(p => p.id === id ? { ...p, resolution: res } : p));
  };

  const executeImport = async () => {
    const validData = previewData.filter(d => d.status !== 'error' && d.resolution !== 'skip');
    if (validData.length === 0) return;

    setLoading(true);
    setLoadingStep("Menyimpan ke database (Batch Process)...");
    setImportProgress({ current: 0, total: validData.length });

    let result = { newItems: 0, updatedItems: 0, skipped: 0, errors: 0 };
    
    // Process in chunks to avoid overwhelming the database
    const chunkSize = 100;
    for (let i = 0; i < validData.length; i += chunkSize) {
      const chunk = validData.slice(i, i + chunkSize);
      
      const newMaterials = [];
      
      for (const row of chunk) {
        if (row.conflictData) {
          // Update existing
          const newStock = row.resolution === 'tambah_stok' 
            ? row.conflictData.current_stock + row.stock 
            : row.stock;
            
          const { error } = await supabase
            .from("materials")
            .update({ 
              current_stock: newStock,
              cost_price: row.cost_price > 0 ? row.cost_price : row.conflictData.cost_price,
              price: row.price > 0 ? row.price : row.conflictData.price,
            })
            .eq("id", row.conflictData.id);
            
          if (error) result.errors++;
          else result.updatedItems++;
        } else {
          // Insert new
          newMaterials.push({
            store: activeStore,
            code: row.code || null,
            name: row.name || "Unnamed Item",
            current_stock: row.stock,
            cost_price: row.cost_price,
            price: row.price
          });
        }
      }

      if (newMaterials.length > 0) {
        const { error } = await supabase.from("materials").insert(newMaterials);
        if (error) {
          console.error("Batch Insert Error:", error);
          result.errors += newMaterials.length;
        } else {
          result.newItems += newMaterials.length;
        }
      }

      setImportProgress({ current: Math.min(i + chunkSize, validData.length), total: validData.length });
    }

    setLoading(false);
    setShowPreview(false);
    setImportResult(result);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold uppercase flex items-center gap-2">
          <Zap className="w-8 h-8 text-blue-600" />
          Smart AI Import
        </h1>
        <p className="text-gray-500 mt-2">Upload Excel, CSV, atau Foto Tabel Stok. AI akan memetakan dan memvalidasi otomatis.</p>
      </div>

      {!showPreview && !importResult && (
        <div 
          className={`border-4 border-dashed p-12 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png" 
            onChange={handleFileChange}
          />
          
          {loading ? (
            <div className="space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-bold text-lg animate-pulse">{loadingStep}</p>
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-6">
                <FileSpreadsheet className="w-16 h-16 text-green-600" />
                <ImageIcon className="w-16 h-16 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold uppercase mb-2">Drag & Drop File Di Sini</h3>
              <p className="text-gray-500 mb-6">atau klik untuk memilih file dari komputer</p>
              <div className="flex gap-4 text-xs font-bold uppercase text-gray-400">
                <span className="bg-gray-100 px-3 py-1 rounded">.XLSX</span>
                <span className="bg-gray-100 px-3 py-1 rounded">.CSV</span>
                <span className="bg-gray-100 px-3 py-1 rounded">.JPG</span>
                <span className="bg-gray-100 px-3 py-1 rounded">.PNG</span>
              </div>
            </>
          )}
        </div>
      )}

      {importResult && (
        <div className="border border-black bg-white p-8">
          <div className="flex items-center justify-center mb-6">
            <CheckCircle className="w-20 h-20 text-green-500" />
          </div>
          <h2 className="text-3xl font-black text-center uppercase mb-8">Import Selesai!</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="border border-black p-4">
              <div className="text-3xl font-bold text-blue-600">{importResult.newItems}</div>
              <div className="text-xs font-bold text-gray-500 uppercase mt-1">Barang Baru</div>
            </div>
            <div className="border border-black p-4">
              <div className="text-3xl font-bold text-green-600">{importResult.updatedItems}</div>
              <div className="text-xs font-bold text-gray-500 uppercase mt-1">Stok Diperbarui</div>
            </div>
            <div className="border border-black p-4">
              <div className="text-3xl font-bold text-gray-600">{importResult.skipped}</div>
              <div className="text-xs font-bold text-gray-500 uppercase mt-1">Di-skip (Abaikan)</div>
            </div>
            <div className="border border-black p-4">
              <div className="text-3xl font-bold text-red-600">{importResult.errors}</div>
              <div className="text-xs font-bold text-gray-500 uppercase mt-1">Error / Gagal</div>
            </div>
          </div>
          <div className="mt-8 text-center">
            <button 
              onClick={() => { setImportResult(null); setPreviewData([]); }}
              className="bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-800 transition-colors"
            >
              Upload File Lain
            </button>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-gray-300 pb-4">
            <div>
              <h2 className="text-2xl font-bold uppercase">Preview & Validasi</h2>
              <p className="text-sm text-gray-500">Cek kembali data hasil bacaan AI sebelum dimasukkan ke database.</p>
            </div>
            <div className="flex gap-4 text-sm font-bold">
              <div className="text-green-600">Valid: {previewData.filter(d => d.status === 'valid').length}</div>
              <div className="text-yellow-600">Warning: {previewData.filter(d => d.status === 'warning').length}</div>
              <div className="text-red-600">Error: {previewData.filter(d => d.status === 'error').length}</div>
            </div>
          </div>

          <div className="border border-black bg-white overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-black text-white uppercase tracking-wide text-xs z-10">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Kode</th>
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 text-right">Stok Import</th>
                    <th className="p-3 text-right">H. Modal</th>
                    <th className="p-3 text-right">H. Jual</th>
                    <th className="p-3 text-center border-l border-gray-700 bg-gray-900">Resolusi Konflik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.map((row) => (
                    <tr key={row.id} className={`hover:bg-gray-50 ${row.status === 'error' ? 'bg-red-50' : row.status === 'warning' ? 'bg-yellow-50' : ''}`}>
                      <td className="p-3">
                        {row.status === 'valid' && <span title="Valid"><CheckCircle className="w-5 h-5 text-green-500" /></span>}
                        {row.status === 'warning' && <span title={row.statusMessage}><AlertTriangle className="w-5 h-5 text-yellow-500" /></span>}
                        {row.status === 'error' && <span title={row.statusMessage}><XCircle className="w-5 h-5 text-red-500" /></span>}
                      </td>
                      <td className="p-3 font-mono text-xs">{row.code || "-"}</td>
                      <td className="p-3 font-bold">{row.name || <span className="text-red-500 italic">Kosong</span>}</td>
                      <td className="p-3 text-right font-mono">{row.stock}</td>
                      <td className="p-3 text-right font-mono">{row.cost_price.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right font-mono">{row.price.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center border-l border-gray-200">
                        {row.conflictData ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">{row.statusMessage}</span>
                            <select 
                              className="text-xs font-bold border border-black p-1 bg-white focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                              value={row.resolution}
                              onChange={(e) => updateResolution(row.id, e.target.value as any)}
                            >
                              <option value="tambah_stok">Tambah Stok (Stok Lama + Stok Import)</option>
                              <option value="set_stok">Set Stok (Timpa Stok Lama)</option>
                              <option value="skip">Skip (Abaikan Baris Ini)</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-green-600 font-bold uppercase">✅ Item Baru</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center bg-gray-100 p-4 border border-black">
            <div>
              {loading && (
                <div className="flex items-center gap-4">
                  <div className="w-full bg-gray-300 h-2 w-48 rounded overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
                  </div>
                  <span className="text-sm font-bold uppercase">{importProgress.current} / {importProgress.total}</span>
                  <span className="text-sm text-gray-500">{loadingStep}</span>
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => { setShowPreview(false); setPreviewData([]); }}
                disabled={loading}
                className="px-6 py-3 font-bold uppercase border border-black hover:bg-gray-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={executeImport}
                disabled={loading || previewData.filter(d => d.status !== 'error').length === 0}
                className="px-6 py-3 font-bold uppercase bg-black text-white flex items-center gap-2 hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                Import Sekarang <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
