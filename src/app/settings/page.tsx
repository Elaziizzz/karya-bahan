"use client";

import { Settings as SettingsIcon, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-12 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        SETTINGS & SECURITY
      </h2>

      <div className="border border-black p-6 bg-white hover-elevate transition-swiss">
        <h3 className="text-lg font-bold uppercase mb-4">Keamanan Akun</h3>
        <p className="text-gray-600 mb-6">
          Sistem saat ini menggunakan mode keamanan ketat (Session Cookie). Setiap kali Anda menutup browser, sesi login akan otomatis terhapus dan Anda harus memasukkan kata sandi kembali saat membukanya.
        </p>
        
        <form action={logout}>
          <button type="submit" className="bg-red-600 text-white font-bold uppercase px-6 py-3 flex items-center gap-2 hover:bg-red-800 transition-swiss hover-elevate active-press">
            <LogOut className="w-5 h-5" />
            Logout Sekarang
          </button>
        </form>
      </div>
    </div>
  );
}
