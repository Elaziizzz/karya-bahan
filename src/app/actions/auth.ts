"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  let storeId: string | null = null;

  if (email === "karyabahan123@gmail.com" && password === "karyabahan33") {
    storeId = "karya_bahan";
  } else if (email === "karyabahan02@gmail.com" && password === "karyabahan33") {
    storeId = "karya_bahan_02";
  }

  if (storeId) {
    const cookieStore = await cookies();
    cookieStore.set("auth", "true", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    cookieStore.set("store", storeId, { 
      httpOnly: false, 
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return { success: true, store: storeId };
  }

  return { success: false, error: "Email atau Password salah" };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("auth");
  cookieStore.delete("store");
  redirect("/login");
}

export async function selectStore(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set("store", storeId, { 
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/");
}

export async function clearStore() {
  const cookieStore = await cookies();
  cookieStore.delete("store");
  redirect("/login");
}
