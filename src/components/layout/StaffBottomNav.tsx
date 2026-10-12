"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/hooks/use-current-user";
import {
    buildMobileNavigation,
    isNavigationItemActive,
    type NavigationItem,
} from "./navigation";

type StaffBottomNavProps = {
    items: NavigationItem[];
    primaryRole: UserRole;
    onMore: () => void;
};

export function StaffBottomNav({ items, primaryRole, onMore }: StaffBottomNavProps) {
    const pathname = usePathname();
    const primaryItems = buildMobileNavigation(items, primaryRole);

    return (
        <nav
            aria-label="Staff navigation"
            className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200/90 bg-white/95 px-2 pt-2 shadow-[0_-12px_32px_rgba(15,23,42,0.09)] backdrop-blur-xl lg:hidden"
            style={{
                gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))`,
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            }}
        >
            {primaryItems.map((item) => {
                const active = isNavigationItemActive(pathname, item);
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors",
                            active ? "bg-teal-50 text-teal-700" : "text-slate-500 active:bg-slate-100",
                        )}
                    >
                        <Icon className="h-5 w-5" />
                        <span className="max-w-full truncate">{item.shortLabel || item.label}</span>
                    </Link>
                );
            })}
            <button
                type="button"
                onClick={onMore}
                className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-500 active:bg-slate-100"
            >
                <Menu className="h-5 w-5" />
                <span>More</span>
            </button>
        </nav>
    );
}
