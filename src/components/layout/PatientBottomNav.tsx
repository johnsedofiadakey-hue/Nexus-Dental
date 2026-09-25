"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, FileText, Home, Menu, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
    { label: "Home", href: "/portal", icon: Home },
    { label: "Book", href: "/booking", icon: CalendarPlus },
    { label: "Records", href: "/portal/records", icon: FileText },
    { label: "Messages", href: "/portal/messages", icon: MessageSquare },
] as const;

export function PatientBottomNav({ onMore }: { onMore: () => void }) {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Patient navigation"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
            {items.map((item) => {
                const active = item.href === "/portal" ? pathname === item.href : pathname.startsWith(item.href);
                return (
                    <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold", active ? "bg-teal-50 text-teal-700" : "text-slate-500")}>
                        <item.icon className="h-5 w-5" />{item.label}
                    </Link>
                );
            })}
            <button type="button" onClick={onMore} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-slate-500">
                <Menu className="h-5 w-5" />More
            </button>
        </nav>
    );
}
