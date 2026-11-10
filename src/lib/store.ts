export type StoreConfig = {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  address: string;
  phone: string;
  email: string;
};

export const STORES: Record<string, StoreConfig> = {
  karya_bahan: {
    id: "karya_bahan",
    name: "KARYA BAHAN JAYA PLAVON",
    shortName: "Karya Bahan",
    badge: "Toko Utama",
    address: "Jl.Raya Barat No.6 Kasturi Cikijing,Majalengka",
    phone: "081323299754 / 085722328871",
    email: "karyabahan123@gmail.com",
  },
  karya_bahan_02: {
    id: "karya_bahan_02",
    name: "KARYA BAHAN 2 (CABANG)",
    shortName: "Karya Bahan 2",
    badge: "Cabang 2",
    address: "Cabang 2",
    phone: "-",
    email: "karyabahan02@gmail.com",
  },
};

export function getActiveStore(): string {
  if (typeof document !== "undefined") {
    // 1. Try reading cookie
    const match = document.cookie.match(/(?:^|;\s*)store=([^;]*)/);
    if (match && match[1]) {
      const val = decodeURIComponent(match[1]);
      if (STORES[val]) return val;
    }
    // 2. Fallback to localStorage
    try {
      const saved = localStorage.getItem("active_store");
      if (saved && STORES[saved]) return saved;
    } catch (e) {
      // ignore
    }
  }
  return "karya_bahan"; // Safe fallback to primary store
}

export function getStoreConfig(storeId?: string): StoreConfig {
  const id = storeId || getActiveStore();
  return STORES[id] || STORES.karya_bahan;
}
