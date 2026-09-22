"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import CommandPalette from "@/components/CommandPalette";
import SupportChat from "@/components/SupportChat";
import ThemeToggle from "@/components/ThemeToggle";

type NavItem = { href: string; label: string; icon: string };

const COLLAPSE_KEY = "scopevanta:sidebarCollapsed";

// Visual/layout shell only — purely presentational state (collapse + mobile
// drawer), no data fetching, no behavior change to any route or action.
export default function Sidebar({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  // Avoid a flash of the wrong width before localStorage is read.
  const widthClass = mounted && collapsed ? "lg:w-14" : "lg:w-64";

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0 font-body">
      {/* Mobile top bar — replaces the desktop collapse toggle below lg */}
      <div className="no-print fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-2 border-b border-border-hairline bg-surface-1 px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="rounded-[4px] p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-[4px] bg-accent flex items-center justify-center text-surface-0 font-bold text-[10px]">SV</div>
          <span className="font-display text-sm font-medium tracking-tight text-ink-primary">ScopeVanta</span>
        </div>
      </div>

      {/* Backdrop for the mobile off-canvas drawer */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border-hairline bg-surface-1 transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:transition-[width] lg:duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${widthClass}`}
      >
        <div className={`flex items-center gap-2.5 border-b border-border-hairline px-5 py-4 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <div className="h-6 w-6 shrink-0 rounded-[4px] bg-accent flex items-center justify-center text-surface-0 font-bold text-xs">
            SV
          </div>
          <span className={`font-display text-lg font-medium tracking-tight text-ink-primary ${collapsed ? "lg:hidden" : ""}`}>
            ScopeVanta
          </span>
        </div>

        <div className={`border-b border-border-hairline px-3 py-3 ${collapsed ? "lg:hidden" : ""}`}>
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-between text-ink-primary bg-surface-2 border border-border-hairline rounded-[4px] px-3 py-1.5 text-xs font-mono hover:bg-surface-3 transition-colors",
              },
            }}
          />
        </div>

        <div className={`px-3 pt-3 ${collapsed ? "lg:hidden" : ""}`}>
          <CommandPalette />
        </div>

        <nav className={`flex-1 space-y-0.5 px-3 py-4 ${collapsed ? "lg:px-2" : ""}`}>
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`group relative flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-xs font-medium transition-colors ${
                  collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""
                } ${active ? "bg-surface-2 text-ink-primary" : "text-ink-muted hover:bg-surface-2 hover:text-ink-primary"}`}
              >
                <span className={`material-symbols-outlined text-[18px] shrink-0 ${active ? "text-accent" : "text-ink-muted group-hover:text-ink-primary"}`}>
                  {item.icon}
                </span>
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                {collapsed && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-[4px] border border-border-hairline bg-surface-3 px-2 py-1 text-xs text-ink-primary shadow-lg group-hover:lg:block">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div
          className={`flex items-center gap-2 border-t border-border-hairline px-3 py-3 ${
            collapsed ? "lg:flex-col lg:justify-center lg:gap-1.5 lg:px-0" : "lg:justify-between"
          }`}
        >
          <ThemeToggle collapsed={collapsed} />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden rounded-[4px] p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink-primary lg:flex lg:items-center lg:justify-center`}
          >
            <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
              chevron_left
            </span>
          </button>
        </div>

        <div className={`flex items-center gap-2.5 border-t border-border-hairline px-5 py-3.5 bg-surface-1 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <UserButton />
          <span className={`text-xs text-ink-disabled font-mono ${collapsed ? "lg:hidden" : ""}`}>Workspace Auth</span>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-surface-0 px-4 py-6 pt-16 sm:px-6 lg:px-8 lg:py-8 lg:pt-8">{children}</main>
      <SupportChat />
    </div>
  );
}
