"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Plus, Search, Edit2, Trash2, Check, X, Upload, Zap, FileSpreadsheet, Image as ImageIcon, CheckCircle2, AlertCircle, XCircle, ArrowRight, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ui/ToastProvider";

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
  store: string;
  code?: string;
};

type ImportRow = {
  id: string;
  code: string;
  name: string;
  stock: number;
  cost_price: number;
  price: number;
  status: 'valid' | 'warning' | 'error';
  statusMessage?: string;
  conflictData?: any;
  resolution?: 'tambah_stok' | 'set_stok' | 'skip';
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStore] = useState<string>("karya_bahan");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ baseUnit: 'Pcs', hasPack: false, packName: 'Pack', packMultiplier: '', buyQty: '', packCost: '',
    name: "", unit_info: "",
    code: "",
    cost_price: "",
    price: "",
    current_stock: "",
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  function openAddModal() {
    setEditingId(null);
    setFormData({ baseUnit: 'Pcs', hasPack: false, packName: 'Pack', packMultiplier: '', buyQty: '', packCost: '', name: '', unit_info: '', code: '', cost_price: '', price: '', current_stock: '' });
    setIsModalOpen(true);
  }

  function openEditModal(item: Material) {
    setEditingId(item.id);
    let baseUnit = 'Pcs';
    let hasPack = false;
    let packName = 'Pack';
    let packMultiplier = '';
    const cleanName = item.name.replace(/\s*-\s*\[(.*?)\]$/, '');
    const unitMatch = item.name.match(/\s*-\s*\[(.*?)\]$/);
    if (unitMatch) {
      const info = unitMatch[1];
      const packMatch = info.match(/1\s+([^=]+?)\s*=\s*(\d+)\s+([^\]]+?)$/);
      if (packMatch) {
        hasPack = true;
        packName = packMatch[1].trim();
        packMultiplier = packMatch[2];
        baseUnit = packMatch[3].trim();
      } else {
        baseUnit = info.trim();
      }
    }
    setFormData({
      baseUnit, hasPack, packName, packMultiplier, buyQty: '', packCost: '',
      name: cleanName, unit_info: '', code: item.code || '',
      cost_price: String(item.cost_price), price: String(item.price), current_stock: String(item.current_stock)
    });
    setIsModalOpen(true);
  }

  // Smart Import States
  const [showImportSection, setShowImportSection] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<{
    newItems: number;
    updatedItems: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMaterials("karya_bahan");
  }, []);

  async function fetchMaterials(store: string) {
    setLoading(true);
    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("store", store)
      .order("name");
    if (data) setMaterials(data);
    setLoading(false);
  }

  // --- Manual Material Handlers ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    let finalName = formData.name;
    if (formData.hasPack && formData.packName && formData.packMultiplier) {
      finalName = `${formData.name} - [1 ${formData.packName} = ${formData.packMultiplier} ${formData.baseUnit}]`;
    } else if (formData.baseUnit && formData.baseUnit !== 'Pcs') {
      finalName = `${formData.name} - [${formData.baseUnit}]`;
    }

    if (editingId) {
      const { error } = await supabase
        .from("materials")
        .update({
          name: finalName,
          code: formData.code || null,
          cost_price: Number(formData.cost_price),
          price: Number(formData.price),
          current_stock: Number(formData.current_stock),
        })
        .eq("id", editingId);

      if (error) {
        showToast("Error memperbarui material: " + error.message, "error");
      } else {
        showToast("Material berhasil diperbarui!", "success");
        setIsModalOpen(false);
        setEditingId(null);
        fetchMaterials(activeStore);
      }
    } else {
      const { data: newMaterial, error } = await supabase.from("materials").insert([
        {
          name: finalName,
          code: formData.code || null,
          current_stock: Number(formData.current_stock),
          cost_price: Number(formData.cost_price),
          price: Number(formData.price),
          store: activeStore,
        },
      ]).select();

      if (error) {
        showToast("Error menambah material: " + error.message, "error");
      } else if (newMaterial && newMaterial.length > 0) {
        if (Number(formData.current_stock) > 0 && Number(formData.cost_price) > 0) {
          await supabase.from("transactions").insert([{
            material_id: newMaterial[0].id,
            type: "IN",
            quantity: Number(formData.current_stock),
            cost_price: Number(formData.cost_price),
            total_price: Number(formData.cost_price) * Number(formData.current_stock),
            store: activeStore
          }]);
        }
        showToast("Material berhasil ditambahkan!", "success");
        setIsModalOpen(false);
        fetchMaterials(activeStore);
      }
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this material?")) return;

    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) {
      showToast("Gagal menghapus material: " + error.message, "error");
    } else {
      showToast("Material berhasil dihapus", "success");
      fetchMaterials(activeStore);
    }
  }

  // --- Smart Import Handlers ---
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
    setImportLoading(true);
    setLoadingStep("Membaca file...");
    setPreviewData([]);
    setShowPreview(false);
    setImportResult(null);

    try {
      const fileType = file.name.split('.').pop()?.toLowerCase();
      let extractedData: any[] = [];

      if (['jpg', 'jpeg', 'png'].includes(fileType || '')) {
        setLoadingStep("AI sedang membaca tabel dari gambar...");
        const formData = new FormData();
        formData.append("action", "OCR_IMAGE");
        formData.append("image", file);

        const response = await fetch("/api/ai-import", { method: "POST", body: formData });
        const data = await response.json();
        
        if (!response.ok) {
          showToast(data.error || "Gagal memproses gambar", "error");
          throw new Error(data.error || "Gagal memproses gambar");
        }
        extractedData = data;
        showToast("Gambar berhasil dianalisis!", "success");

      } else if (['xlsx', 'xls', 'csv'].includes(fileType || '')) {
        setLoadingStep("Mengekstrak data tabel...");
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        if (rawData.length < 2) throw new Error("File kosong atau tidak memiliki baris data");

        const headers = rawData[0];
        const sampleRows = rawData.slice(1, 5);

        setLoadingStep("AI sedang memetakan kolom secara otomatis...");
        const formData = new FormData();
        formData.append("action", "MAP_COLUMNS");
        formData.append("headers", JSON.stringify(headers));
        formData.append("sampleRows", JSON.stringify(sampleRows));

        const response = await fetch("/api/ai-import", { method: "POST", body: formData });
        const mapping = await response.json();

        if (!response.ok) throw new Error(mapping.error || "Gagal memetakan kolom");
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          let rowObj: any = {};
          headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

          let mappedRow: any = { code: "", name: "", unit_info: "", stock: 0, cost_price: 0, price: 0 };
          if (mapping.code) mappedRow.code = String(rowObj[mapping.code] || "");
          if (mapping.name) mappedRow.name = String(rowObj[mapping.name] || "");
          if (mapping.stock) mappedRow.stock = Number(rowObj[mapping.stock]) || 0;
          if (mapping.cost_price) mappedRow.cost_price = Number(rowObj[mapping.cost_price]) || 0;
          if (mapping.price) mappedRow.price = Number(rowObj[mapping.price]) || 0;

          if (mappedRow.name || mappedRow.code) extractedData.push(mappedRow);
        }
        showToast("Data tabel berhasil dipetakan!", "success");
      } else {
        throw new Error("Format file tidak didukung.");
      }

      await validateAndCheckConflicts(extractedData);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateAndCheckConflicts = async (data: any[]) => {
    setLoadingStep("Memvalidasi dan mengecek konflik...");
    const { data: existingMaterials } = await supabase.from("materials").select("*").eq("store", activeStore);

    const processedData: ImportRow[] = data.map((item, index) => {
      let status: 'valid' | 'warning' | 'error' = 'valid';
      let statusMessage = '';
      let conflict = existingMaterials?.find(m => (item.code && m.code?.toLowerCase() === item.code.toLowerCase()) || (item.name && m.name.toLowerCase() === item.name.toLowerCase()));

      if (!item.name && !item.code) { status = 'error'; statusMessage = 'Data tidak lengkap'; }
      else if (conflict) { status = 'warning'; statusMessage = `Barang sudah ada (Stok: ${conflict.current_stock})`; }

      return { id: `temp-${index}`, ...item, status, statusMessage, conflictData: conflict, resolution: conflict ? 'tambah_stok' : undefined };
    });

    setPreviewData(processedData);
    setShowPreview(true);
  };

  const updatePreviewRow = (id: string, field: keyof ImportRow, value: any) => {
    setPreviewData(prev => prev.map(row => {
      if (row.id === id) {
        const newRow = { ...row, [field]: value };
        if (field === 'name' || field === 'code') {
          if (!newRow.name && !newRow.code) {
            newRow.status = 'error';
            newRow.statusMessage = 'Data tidak lengkap';
          } else {
            if (newRow.status === 'error') {
              newRow.status = 'valid';
              newRow.statusMessage = '';
            }
          }
        }
        return newRow;
      }
      return row;
    }));
  };

  const executeImport = async () => {
    const validData = previewData.filter(d => d.status !== 'error' && d.resolution !== 'skip');
    if (validData.length === 0) return;

    setImportLoading(true);
    setLoadingStep("Menyimpan ke database...");
    let result = { newItems: 0, updatedItems: 0, skipped: 0, errors: 0 };
    
    for (const row of validData) {
      if (row.conflictData) {
        const newStock = row.resolution === 'tambah_stok' ? row.conflictData.current_stock + row.stock : row.stock;
        const { error } = await supabase.from("materials").update({ 
            current_stock: newStock,
            code: row.code || row.conflictData.code,
            name: row.name || row.conflictData.name,
            cost_price: row.cost_price || row.conflictData.cost_price,
            price: row.price || row.conflictData.price
        }).eq("id", row.conflictData.id);
        if (error) result.errors++; else result.updatedItems++;
      } else {
        const { error } = await supabase.from("materials").insert({ store: activeStore, code: row.code, name: row.name, current_stock: row.stock, cost_price: row.cost_price, price: row.price });
        if (error) result.errors++; else result.newItems++;
      }
    }

    setImportLoading(false);
    setShowPreview(false);
    setImportResult(result);
    showToast("Import selesai!", "success");
    fetchMaterials(activeStore); // Refresh the main list
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b-2 border-black pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase flex items-center gap-2">
            <Package className="w-8 h-8" />
            MATERIALS / INVENTORY
          </h1>
          <p className="text-gray-500 mt-2">Manage your products, base prices, and starting stock.</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari..."
              className="border border-black p-2 pl-10 focus-ring outline-none transition-swiss w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setShowImportSection(prev => !prev);
              setImportResult(null);
              setShowPreview(false);
            }}
            className="border-2 border-black text-black bg-white px-6 py-2 font-bold uppercase hover:bg-gray-100 transition-swiss flex items-center justify-center gap-2 active-press flex-1 sm:flex-none"
          >
            <Zap className="w-4 h-4 text-blue-600" />
            {showImportSection ? "Tutup AI" : "AI Import"}
          </button>
          <button
            onClick={() => {
              openAddModal();
            }}
            className="bg-black text-white px-6 py-2 font-bold uppercase hover:bg-gray-800 transition-swiss active-press hover-elevate flex-1 sm:flex-none justify-center"
          >
            + Tambah
          </button>
        </div>
      </div>

      {/* --- SMART IMPORT SECTION --- */}
      {showImportSection && (
        <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-blue-50 border-2 border-blue-600 p-6">
            <h2 className="text-xl font-bold uppercase flex items-center gap-2 mb-4 text-blue-800">
              <Zap className="w-6 h-6 animate-pulse text-blue-600" />
              Upload Data via AI
            </h2>
            
            {!showPreview && !importResult && (
              <div 
                className={`border-4 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-300 hover:bg-gray-50'}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png" onChange={handleFileChange} />
                {importLoading ? (
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="font-bold text-lg animate-pulse">{loadingStep}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4 justify-center">
                      <FileSpreadsheet className="w-12 h-12 text-green-600" />
                      <ImageIcon className="w-12 h-12 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold uppercase">Drag & Drop atau Klik untuk Upload</h3>
                      <p className="text-sm text-gray-500 mt-1">Upload foto catatan buku, nota, Excel, atau CSV. AI akan otomatis membacanya.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {importResult && (
              <div className="bg-white border border-black p-6 animate-in zoom-in duration-300 text-center">
                <h3 className="text-2xl font-black mb-6 uppercase">Hasil Import</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(importResult).map(([key, val]) => (
                    <div key={key} className="border border-gray-200 bg-gray-50 p-4 hover-elevate transition-swiss cursor-default">
                      <div className="text-3xl font-black">{val}</div>
                      <div className="text-xs font-bold text-gray-500 uppercase">{key}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setImportResult(null); setShowImportSection(false); }} className="px-8 bg-black text-white py-3 font-bold uppercase hover:bg-gray-800 transition-swiss active-press hover-elevate">Tutup & Selesai</button>
              </div>
            )}

            {showPreview && (
              <div className="bg-white border border-black p-4 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-end border-b border-gray-200 pb-2">
                  <div>
                    <h3 className="text-lg font-bold uppercase">Preview & Edit</h3>
                    <p className="text-xs text-gray-500">Edit data jika ada yang kurang tepat sebelum disimpan.</p>
                  </div>
                  <div className="flex gap-4 text-xs font-bold">
                    <div className="text-green-600">Valid: {previewData.filter(d => d.status === 'valid').length}</div>
                    <div className="text-yellow-600">Warning: {previewData.filter(d => d.status === 'warning').length}</div>
                    <div className="text-red-600">Error: {previewData.filter(d => d.status === 'error').length}</div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 shadow-inner bg-gray-50">
                  <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="sticky top-0 bg-black text-white uppercase tracking-wide text-xs z-10 border-b border-gray-300">
                        <tr>
                          <th className="p-2 w-10 text-center">Sts</th>
                          <th className="p-2">Kode</th>
                          <th className="p-2 min-w-[200px]">Nama Barang</th>
                          <th className="p-2 w-24">Stok</th>
                          <th className="p-2 w-32">H. Modal</th>
                          <th className="p-2 w-32">H. Jual</th>
                          <th className="p-2 min-w-[200px] border-l border-gray-700 bg-gray-900">Resolusi (Jika Konflik)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {previewData.map((row) => (
                          <tr key={row.id} className={`${row.status === 'error' ? 'bg-red-50' : row.status === 'warning' ? 'bg-yellow-50' : 'bg-white hover:bg-gray-50'} ${row.resolution === 'skip' ? 'opacity-50' : ''} transition-swiss group`}>
                            <td className="p-2 text-center border-r border-gray-200">
                              {row.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                              {row.status === 'warning' && <span title={row.statusMessage}><AlertCircle className="w-4 h-4 text-yellow-500 mx-auto" /></span>}
                              {row.status === 'error' && <span title={row.statusMessage}><XCircle className="w-4 h-4 text-red-500 mx-auto" /></span>}
                            </td>
                            <td className="p-1 border-r border-gray-200">
                              <input type="text" value={row.code} onChange={(e) => updatePreviewRow(row.id, 'code', e.target.value)} className="w-full px-2 py-1.5 text-xs font-mono border border-transparent hover:border-gray-300 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-swiss bg-transparent" placeholder="Kode" />
                            </td>
                            <td className="p-1 border-r border-gray-200">
                              <input type="text" value={row.name} onChange={(e) => updatePreviewRow(row.id, 'name', e.target.value)} className={`w-full px-2 py-1.5 text-xs font-bold border border-transparent hover:border-gray-300 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-swiss bg-transparent ${!row.name ? 'border-red-300 bg-red-100/50' : ''}`} placeholder="Nama Barang" />
                            </td>
                            <td className="p-1 border-r border-gray-200">
                              <input type="number" value={row.stock} onChange={(e) => updatePreviewRow(row.id, 'stock', Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-transparent hover:border-gray-300 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-swiss bg-transparent font-mono text-right" />
                            </td>
                            <td className="p-1 border-r border-gray-200">
                              <input type="number" value={row.cost_price} onChange={(e) => updatePreviewRow(row.id, 'cost_price', Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-transparent hover:border-gray-300 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-swiss bg-transparent font-mono text-right text-red-600" />
                            </td>
                            <td className="p-1 border-r border-gray-200">
                              <input type="number" value={row.price} onChange={(e) => updatePreviewRow(row.id, 'price', Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-transparent hover:border-gray-300 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-swiss bg-transparent font-mono text-right text-green-700 font-bold" />
                            </td>
                            <td className="p-2 border-l border-gray-200">
                              {row.conflictData ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] uppercase text-gray-500 font-bold truncate" title={row.statusMessage}>{row.statusMessage}</span>
                                  <select 
                                    className="text-[10px] font-bold border border-black p-1 bg-white focus-ring cursor-pointer hover-elevate transition-swiss"
                                    value={row.resolution}
                                    onChange={(e) => updatePreviewRow(row.id, 'resolution', e.target.value)}
                                  >
                                    <option value="tambah_stok">+ Stok</option>
                                    <option value="set_stok">Timpa Stok</option>
                                    <option value="skip">Skip Data Ini</option>
                                  </select>
                                </div>
                              ) : (
                                <span className="text-[10px] text-green-600 font-bold uppercase flex items-center gap-1 pl-2">
                                  <CheckCircle2 className="w-3 h-3" /> Item Baru
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-gray-100 p-3 border border-black">
                  <div>
                    {importLoading && <span className="text-xs font-bold text-blue-600 animate-pulse">{loadingStep}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setShowPreview(false); setPreviewData([]); }}
                      disabled={importLoading}
                      className="px-6 py-2 text-xs font-bold uppercase border border-black hover:bg-gray-200 disabled:opacity-50 transition-swiss active-press hover-elevate"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={executeImport}
                      disabled={importLoading || previewData.filter(d => d.status !== 'error').length === 0}
                      className="px-6 py-2 text-xs font-bold uppercase bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-swiss active-press hover-elevate"
                    >
                      <Save className="w-4 h-4" />
                      Simpan Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MANUAL ADD / EDIT MODAL --- */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 max-w-3xl w-full border-2 border-black animate-in zoom-in-95 duration-200 shadow-2xl">
              <h2 className="text-xl font-bold mb-4 uppercase flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                {editingId ? "Edit Material" : "Tambah Material"}
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold mb-1 uppercase">Kode Barang (Ops)</label>
                    <input type="text" className="w-full border border-black p-2 focus-ring transition-swiss" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="B001" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1 uppercase">Nama Material</label>
                    <input type="text" required className="w-full border border-black p-2 focus-ring transition-swiss" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Semen, PVC..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* Satuan & Kemasan */}
                  <div className="bg-gray-50 border border-gray-300 p-3 h-full">
                    <label className="block text-xs font-bold mb-3 uppercase text-blue-800 border-b border-gray-200 pb-2">1. Pengaturan Satuan & Kemasan</label>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">Satuan Dasar</label>
                        <select className="w-full border border-black p-2 bg-white text-sm" value={formData.baseUnit} onChange={(e) => setFormData({...formData, baseUnit: e.target.value})}>
                          <option value="Pcs">Pcs</option>
                          <option value="Lembar">Lembar</option>
                          <option value="Batang">Batang</option>
                          <option value="Kg">Kg</option>
                          <option value="Biji">Biji</option>
                          <option value="Meter">Meter</option>
                          <option value="Roll">Roll</option>
                          <option value="Zak">Zak / Sak</option>
                        </select>
                      </div>
                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 accent-black" checked={formData.hasPack} onChange={(e) => setFormData({...formData, hasPack: e.target.checked})} />
                          <span className="text-[10px] font-bold uppercase text-gray-600">Bisa Kemasan/Grosir?</span>
                        </label>
                      </div>
                    </div>

                    {formData.hasPack && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                        <div>
                          <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">Nama Kemasan</label>
                          <select className="w-full border border-black p-2 bg-white text-sm" value={formData.packName} onChange={(e) => setFormData({...formData, packName: e.target.value})}>
                            <option value="Pack">Pack</option>
                            <option value="Dus">Dus / Box</option>
                            <option value="Karton">Karton</option>
                            <option value="Roll">Roll</option>
                            <option value="Sak">Sak</option>
                            <option value="Bal">Bal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">1 {formData.packName} = Berapa {formData.baseUnit}?</label>
                          <input type="number" required min="1" className="w-full border border-black p-2 text-sm" value={formData.packMultiplier} onChange={(e) => setFormData({...formData, packMultiplier: e.target.value.replace(/^0+/, '')})} placeholder="Cth: 15" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stok & Harga */}
                  <div className="bg-gray-50 border border-gray-300 p-3 h-full flex flex-col justify-between">
                    <div>
                      <label className="block text-xs font-bold mb-3 uppercase text-green-800 border-b border-gray-200 pb-2">2. Pengaturan Stok & Harga</label>
                      
                      {(!editingId && formData.hasPack && formData.packMultiplier) ? (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">Beli Berapa {formData.packName}?</label>
                            <input type="number" required min="0" className="w-full border border-black p-2 text-sm" value={formData.buyQty} onChange={(e) => {
                              const val = e.target.value.replace(/^0+/, '');
                              const total = Number(val) * Number(formData.packMultiplier);
                              setFormData({...formData, buyQty: val, current_stock: String(total)});
                            }} placeholder="Cth: 10" />
                            <div className="text-[9px] text-gray-500 mt-1">Total: <b>{formData.current_stock || 0} {formData.baseUnit}</b></div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">Harga Modal / {formData.packName}</label>
                            <input type="number" required min="0" className="w-full border border-black p-2 text-sm" value={formData.packCost} onChange={(e) => {
                              const val = e.target.value.replace(/^0+/, '');
                              const perItem = Number(formData.packMultiplier) > 0 ? Math.round(Number(val) / Number(formData.packMultiplier)) : 0;
                              setFormData({...formData, packCost: val, cost_price: String(perItem)});
                            }} placeholder="Cth: 150000" />
                            <div className="text-[9px] text-gray-500 mt-1">Modal / {formData.baseUnit}: <b>Rp {Number(formData.cost_price).toLocaleString('id-ID')}</b></div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">Stok ({formData.baseUnit})</label>
                            <input type="number" required min="0" className="w-full border border-black p-2 text-sm" value={formData.current_stock} onChange={(e) => setFormData({...formData, current_stock: e.target.value.replace(/^0+/, '')})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold mb-1 uppercase text-gray-600">Modal / {formData.baseUnit}</label>
                            <input type="number" required min="0" className="w-full border border-black p-2 text-sm" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: e.target.value.replace(/^0+/, '')})} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-200 mt-auto">
                      <label className="block text-[10px] font-bold mb-1 uppercase text-blue-600">Harga Jual ke Customer / {formData.baseUnit}</label>
                      <input type="number" required min="0" className="w-full border-2 border-blue-600 p-2 text-lg font-bold" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value.replace(/^0+/, '')})} placeholder="Cth: 12000" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-2 mt-2 border-t border-gray-200">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-200 p-3 font-bold uppercase hover:bg-gray-300 transition-swiss active-press">Batal</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-black text-white p-3 font-bold uppercase hover:bg-gray-800 transition-swiss hover-elevate active-press flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" /> Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* --- INVENTORY TABLE --- */}
      <div className="overflow-x-auto border border-black shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-black text-white uppercase text-xs tracking-wide">
              <th className="p-4 border-r border-gray-700">Kode</th>
              <th className="p-4 border-r border-gray-700">Nama Barang</th>
              <th className="p-4 text-right border-r border-gray-700">Stok</th>
              <th className="p-4 text-right border-r border-gray-700">H. Modal (Rp)</th>
              <th className="p-4 text-right border-r border-gray-700 text-green-400">H. Jual (Rp)</th>
              <th className="p-4 text-right border-r border-gray-700 text-blue-400">Total Nilai Stok</th>
              <th className="p-4 text-right border-r border-gray-700 text-yellow-400">Potensi Profit</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3].map(i => (
                <tr key={i} className="animate-pulse bg-gray-50 border-b border-gray-200">
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-16"></div></td>
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-32"></div></td>
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-12 ml-auto"></div></td>
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-24 ml-auto"></div></td>
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-24 ml-auto"></div></td>
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-24 ml-auto"></div></td>
                  <td className="p-4 border-r border-gray-200"><div className="h-4 bg-gray-200 w-24 ml-auto"></div></td>
                  <td className="p-4"><div className="h-8 bg-gray-200 w-20 mx-auto"></div></td>
                </tr>
              ))
            ) : filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 italic font-bold">Tidak ada material ditemukan.</td>
              </tr>
            ) : filteredMaterials.map((item) => (
              <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition-swiss group">
                <td className="p-4 border-r border-gray-200 font-mono text-xs">{item.code || "-"}</td>
                <td className="p-4 border-r border-gray-200 font-bold group-hover:text-blue-600 transition-colors">{item.name}</td>
                <td className="p-4 border-r border-gray-200 text-right font-mono">
                  <span className={`${item.current_stock <= 10 ? 'text-red-600 bg-red-50 px-2 py-1 font-bold' : ''}`}>
                    {item.current_stock} {item.current_stock <= 10 && 'ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â'}
                  </span>
                </td>
                <td className="p-4 border-r border-gray-200 text-right font-mono text-gray-600">
                  {item.cost_price.toLocaleString("id-ID")}
                </td>
                <td className="p-4 border-r border-gray-200 text-right font-mono font-bold text-green-700">
                  {item.price.toLocaleString("id-ID")}
                </td>
                <td className="p-4 border-r border-gray-200 text-right font-mono font-bold text-blue-700">
                  {(item.current_stock * (item.cost_price || 0)).toLocaleString("id-ID")}
                </td>
                <td className="p-4 border-r border-gray-200 text-right font-mono font-bold text-yellow-600">
                  {(item.current_stock * (item.price - (item.cost_price || 0))).toLocaleString("id-ID")}
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => { 
                        openEditModal(item); 
                      }} 
                      className="p-1.5 border border-black text-black hover:bg-black hover:text-white transition-swiss active-press hover-elevate"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      className="p-1.5 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-swiss active-press hover-elevate"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}









