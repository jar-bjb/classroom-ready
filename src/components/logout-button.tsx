"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";

export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={`inline-flex items-center gap-2 ${className}`}>
        <LogOut size={16} /> Keluar
      </button>
    </form>
  );
}
