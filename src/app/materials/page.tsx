"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Plus, Trash2, Edit2, Check, X } from "lucide-react";

// Removed getCookie

type Material = {
  id: string;
  name: string;
  current_stock: number;
  cost_price: number;
  price: number;
  store: string;
  code?: string;
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStore] = useState<string>("karya_bahan");

  // Form states for creating a new material
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || newPrice === "" || Number(newPrice) < 0 || newCostPrice === "" || Number(newCostPrice) < 0 || newStock === "" || Number(newStock) < 0) return;

    setIsCreating(true);
    const { error } = await supabase.from("materials").insert([
      { 
        name: newName, 
        code: newCode || null,
        current_stock: Number(newStock), 
        cost_price: Number(newCostPrice),
        price: Number(newPrice),
        store: activeStore 
      }
    ]);

    setIsCreating(false);
    if (!error) {
      setNewName("");
      setNewCode("");
      setNewStock("");
      setNewCostPrice("");
      setNewPrice("");
      fetchMaterials(activeStore); // Reload list
    } else {
      alert("Error adding material: " + (error.message || JSON.stringify(error)));
      console.error(error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this material?")) return;

    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) {
      alert("Error deleting material. It might have transaction history that prevents deletion.");
      console.error(error);
    } else {
      fetchMaterials(activeStore);
    }
  }

  function startEditing(m: Material) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditCode(m.code || "");
    setEditCostPrice(String(m.cost_price));
    setEditPrice(String(m.price));
    setEditStock(String(m.current_stock));
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveEditing(id: string) {
    if (!editName || editPrice === "" || Number(editPrice) < 0 || editCostPrice === "" || Number(editCostPrice) < 0 || editStock === "" || Number(editStock) < 0) return;

    const { error } = await supabase
      .from("materials")
      .update({ name: editName, code: editCode || null, cost_price: Number(editCostPrice), price: Number(editPrice), current_stock: Number(editStock) })
      .eq("id", id);

    if (!error) {
      setEditingId(null);
      fetchMaterials(activeStore);
    } else {
      alert("Error updating material.");
      console.error(error);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold uppercase flex items-center gap-2">
          <Package className="w-8 h-8" />
          MATERIALS / INVENTORY
        </h1>
        <p className="text-gray-500 mt-2">Manage your products, base prices, and starting stock.</p>
      </div>

      {/* CREATE FORM */}
      <div className="border border-black p-6 bg-gray-50">
        <h2 className="text-lg font-bold uppercase mb-4">Add New Material</h2>
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold mb-1 uppercase">Material Name</label>
            <input
              type="text"
              className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Semen Putih 40kg"
              required
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-sm font-bold mb-1 uppercase">Kode Barang</label>
            <input
              type="text"
              className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black uppercase"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. SMN-01"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-sm font-bold mb-1 uppercase">Start Stock</label>
            <input
              type="number"
              min="0"
              className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value.replace(/^0+(?=\d)/, ''))}
              placeholder="e.g. 50"
              required
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-bold mb-1 uppercase">Harga Modal / Pcs</label>
            <input
              type="number"
              min="0"
              className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              value={newCostPrice}
              onChange={(e) => setNewCostPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
              placeholder="e.g. 100000"
              required
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-bold mb-1 uppercase text-green-700">Harga Jual / Pcs</label>
            <input
              type="number"
              min="0"
              className="w-full border border-black p-2 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
              placeholder="e.g. 150000"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full md:w-auto bg-black text-white px-6 py-2.5 font-bold uppercase hover:bg-gray-800 disabled:bg-gray-400 flex justify-center items-center gap-2"
          >
            {isCreating ? "..." : <><Plus className="w-4 h-4" /> Add</>}
          </button>
        </form>
      </div>

      {/* READ / UPDATE / DELETE TABLE */}
      <div>
        <div className="overflow-x-auto border border-black">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-black text-white uppercase tracking-wide text-xs">
                <th className="p-4 font-bold border-r border-gray-700">Kode</th>
                <th className="p-4 font-bold border-r border-gray-700">Nama Barang</th>
                <th className="p-4 font-bold border-r border-gray-700 text-right">Stok</th>
                <th className="p-4 font-bold border-r border-gray-700 text-right">H. Modal (Rp)</th>
                <th className="p-4 font-bold border-r border-gray-700 text-right text-green-400">H. Jual (Rp)</th>
                <th className="p-4 font-bold border-r border-gray-700 text-right text-blue-400">Total Nilai Stok</th>
                <th className="p-4 font-bold border-r border-gray-700 text-right text-yellow-400">Potensi Profit</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">Loading materials...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 italic">No materials found.</td>
                </tr>
              ) : (
                materials.map((m) => (
                  <tr key={m.id} className="border-b border-black last:border-b-0 hover:bg-gray-50">
                    <td className="p-4 border-r border-black font-mono">
                      {editingId === m.id ? (
                        <input
                          type="text"
                          className="w-full border border-black p-1 focus:outline-none focus:ring-1 focus:ring-black uppercase"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                        />
                      ) : (
                        m.code || "-"
                      )}
                    </td>
                    <td className="p-4 border-r border-black">
                      {editingId === m.id ? (
                        <input
                          type="text"
                          className="w-full border border-black p-1 focus:outline-none focus:ring-1 focus:ring-black"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        <span className="font-bold">{m.name}</span>
                      )}
                    </td>
                    <td className="p-4 border-r border-black text-right font-mono text-lg">
                      {editingId === m.id ? (
                        <input
                          type="number"
                          className="w-full border border-black p-1 text-right focus:outline-none focus:ring-1 focus:ring-black"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value.replace(/^0+(?=\d)/, ''))}
                        />
                      ) : (
                        m.current_stock
                      )}
                    </td>
                    <td className="p-4 border-r border-black text-right font-mono">
                      {editingId === m.id ? (
                        <input
                          type="number"
                          className="w-full border border-black p-1 text-right focus:outline-none focus:ring-1 focus:ring-black"
                          value={editCostPrice}
                          onChange={(e) => setEditCostPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
                        />
                      ) : (
                        m.cost_price?.toLocaleString("id-ID") || 0
                      )}
                    </td>
                    <td className="p-4 border-r border-black text-right font-mono text-green-700 font-bold">
                      {editingId === m.id ? (
                        <input
                          type="number"
                          className="w-full border border-black p-1 text-right focus:outline-none focus:ring-1 focus:ring-black"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value.replace(/^0+(?=\d)/, ''))}
                        />
                      ) : (
                        m.price.toLocaleString("id-ID")
                      )}
                    </td>
                    <td className="p-4 border-r border-black text-right font-mono font-bold text-blue-700">
                      {editingId === m.id ? "-" : (m.current_stock * (m.cost_price || 0)).toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 border-r border-black text-right font-mono font-bold text-yellow-600">
                      {editingId === m.id ? "-" : (m.current_stock * (m.price - (m.cost_price || 0))).toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-center">
                      {editingId === m.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => saveEditing(m.id)} className="p-1 text-green-600 hover:bg-green-100 border border-green-600">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEditing} className="p-1 text-gray-600 hover:bg-gray-200 border border-gray-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => startEditing(m)} className="p-1 text-blue-600 hover:bg-blue-100 border border-blue-600 transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="p-1 text-red-600 hover:bg-red-100 border border-red-600 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

