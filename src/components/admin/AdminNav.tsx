"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = { href: string; label: string; icon: string };

export default function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-[4px] px-3 py-2 text-sm font-body transition-colors ${
              active ? "bg-surface-3 text-ink-primary" : "text-ink-muted hover:bg-surface-2 hover:text-ink-primary"
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${active ? "text-accent" : ""}`}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
