"use client";

import Link from "next/link";
import { Home, LayoutDashboard, BrainCircuit, PenTool } from "lucide-react";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Inicio", href: "/", icon: <Home size={20} /> },
    { name: "Tutor", href: "/", icon: <BrainCircuit size={20} /> },
    { name: "Dictado", href: "/dictado", icon: <PenTool size={20} /> },
    { name: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={20} /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-[100] px-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
          IA
        </div>
        <span className="font-bold text-gray-800 text-lg hidden sm:block">
          Tutor Pro
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium
                ${isActive 
                  ? "bg-blue-50 text-blue-600" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }
              `}
            >
              {item.icon}
              <span className="hidden md:block">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {/* Placeholder para login/perfil */}
        <div className="w-10 h-10 bg-gray-100 rounded-full border-2 border-white shadow-sm" />
      </div>
    </nav>
  );
}
