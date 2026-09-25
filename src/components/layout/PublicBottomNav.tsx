"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, CircleUserRound, Home, MessageCircle, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
    { label: "Home", href: "/", icon: Home, primary: false },
    { label: "Services", href: "/services", icon: Stethoscope, primary: false },
    { label: "Book", href: "/booking", icon: CalendarPlus, primary: true },
    { label: "Portal", href: "/auth/patient", icon: CircleUserRound, primary: false },
    { label: "Contact", href: "/contact", icon: MessageCircle, primary: false },
] as const;

export default function PublicBottomNav() {
    const pathname = usePathname();
    return (
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border-light bg-white/95 px-2 pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold no-underline", item.primary ? "-mt-5 min-h-16 rounded-2xl bg-primary text-white shadow-lg shadow-primary/25" : active ? "bg-primary/10 text-primary-dark" : "text-text-muted")}><item.icon className={item.primary ? "h-6 w-6" : "h-5 w-5"} />{item.label}</Link>;
            })}
        </nav>
    );
}
