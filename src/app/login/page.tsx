"use client";

import { useState } from "react";
import { login } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result.success) {
      router.push("/");
    } else {
      setError(result.error || "Gagal login");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 absolute inset-0 z-50 overflow-hidden">
      {/* Minimalist Grid Background (Kotak-kotak) */}
      <div 
        className="absolute inset-0 z-0 opacity-50"
        style={{
          backgroundImage: "linear-gradient(#0000001a 2px, transparent 2px), linear-gradient(90deg, #0000001a 2px, transparent 2px)",
          backgroundSize: "40px 40px"
        }}
      ></div>
      
      {/* Dekorasi Kotak Minimalis */}
      <div className="absolute top-20 left-20 w-32 h-32 border-4 border-gray-200 z-0 rotate-12 hidden md:block"></div>
      <div className="absolute bottom-20 right-32 w-48 h-48 border-4 border-gray-200 z-0 -rotate-6 hidden md:block"></div>

      <div className="relative z-10 max-w-md w-full bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-black flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-black uppercase text-center mb-2">Karya Bahan</h1>
        <p className="text-center text-gray-500 mb-8 font-medium">Sistem Inventori & Kasir</p>

        {error && (
          <div className="bg-red-100 border border-red-500 text-red-700 p-3 mb-6 font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold uppercase mb-2">Email</label>
            <input 
              type="email" 
              name="email"
              required
              className="w-full border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
              placeholder="Masukkan email..."
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.toLowerCase(); }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold uppercase mb-2">Password</label>
            <input 
              type="password" 
              name="password"
              required
              className="w-full border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white font-bold uppercase py-4 hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {loading ? "VERIFYING..." : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
