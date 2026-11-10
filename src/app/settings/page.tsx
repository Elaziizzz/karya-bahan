"use client";

import { Settings as SettingsIcon, LogOut, Store, ShieldCheck } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { useEffect, useState } from "react";
import { getActiveStore, getStoreConfig } from "@/lib/store";

export default function SettingsPage() {
  const [storeId, setStoreId] = useState("karya_bahan");

  useEffect(() => {
    setStoreId(getActiveStore());
  }, []);

  const config = getStoreConfig(storeId);

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.removeItem("active_store");
    } catch (err) {
      // ignore
    }
    await logout();
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        SETTINGS & CABANG TOKO
      </h2>

      {/* Info Akun / Cabang Aktif */}
      <div className="border-2 border-black p-6 bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl space-y-4">
        <div className="flex items-center gap-3 border-b pb-3">
          <Store className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-black uppercase">{config.name}</h3>
            <p className="text-xs text-gray-500 font-bold">{config.badge} &bull; ID Database: <code className="bg-gray-100 px-1 py-0.5 border">{config.id}</code></p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-bold uppercase text-gray-400 block">Email Akun Aktif</span>
            <span className="font-mono font-bold text-gray-800">{config.email}</span>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-gray-400 block">Status Data Cabang</span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-300">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Terpisah & Mandiri
            </span>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-gray-400 block">Alamat di Nota</span>
            <span className="font-medium text-gray-800">{config.address}</span>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-gray-400 block">No. Telepon di Nota</span>
            <span className="font-medium text-gray-800">{config.phone}</span>
          </div>
        </div>
      </div>

      <div className="border border-black p-6 bg-white hover-elevate transition-swiss">
        <h3 className="text-lg font-bold uppercase mb-4">Keamanan Akun</h3>
        <p className="text-gray-600 mb-6">
          Sistem saat ini menggunakan mode keamanan ketat (Session Cookie). Setiap kali Anda menutup browser, sesi login akan otomatis terhapus dan Anda harus memasukkan kata sandi kembali saat membukanya.
        </p>
        
        <form onSubmit={handleLogout}>
          <button type="submit" className="bg-red-600 text-white font-bold uppercase px-6 py-3 flex items-center gap-2 hover:bg-red-800 transition-swiss hover-elevate active-press">
            <LogOut className="w-5 h-5" />
            Logout Sekarang
          </button>
        </form>
      </div>
    </div>
  );
}
