"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Menu, X } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoNavbar({ client }: { client: ClientData }) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const base = `/client-demo/${client.id}`;

    const navLinks = [
        { label: "Home", href: base },
        { label: "About Us", href: `${base}/about` },
        { label: "Services", href: `${base}/services` },
        { label: "Contact Us", href: `${base}/contact` },
    ];

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 12);
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
    const primary = client.colors.primary;

    return (
        <header
            className={`sticky inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
                scrolled ? "border-black/5 bg-white/95 shadow-sm backdrop-blur-xl" : "border-transparent bg-white"
            }`}
        >
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href={base} className="flex items-center gap-2 no-underline">
                    <Image src={client.logo} alt={`${client.name} logo`} width={150} height={46} className="h-10 w-auto object-contain" />
                </Link>

                <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="relative py-2 text-sm font-semibold no-underline transition-colors"
                            style={{ color: isActive(link.href) ? primary : client.colors.text }}
                        >
                            {link.label}
                            {isActive(link.href) && (
                                <span className="absolute inset-x-0 -bottom-1 mx-auto h-0.5 w-6 rounded-full" style={{ backgroundColor: primary }} />
                            )}
                        </Link>
                    ))}
                </nav>

                <div className="hidden lg:flex">
                    <Link
                        href={`${base}/contact`}
                        className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white no-underline shadow-sm transition-transform hover:-translate-y-0.5"
                        style={{ backgroundColor: primary }}
                    >
                        <CalendarDays className="h-4 w-4" />
                        Book Appointment
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => setIsOpen((open) => !open)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white lg:hidden"
                    style={{ color: client.colors.text }}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Close menu" : "Open menu"}
                >
                    {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-x-3 top-[5.4rem] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-xl lg:hidden"
                    >
                        <nav className="grid gap-1 p-3" aria-label="Mobile navigation">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-2xl px-4 py-3 text-sm font-semibold no-underline"
                                    style={{
                                        color: isActive(link.href) ? primary : client.colors.text,
                                        backgroundColor: isActive(link.href) ? `${primary}14` : "transparent",
                                    }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <Link
                                href={`${base}/contact`}
                                onClick={() => setIsOpen(false)}
                                className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white no-underline"
                                style={{ backgroundColor: primary }}
                            >
                                <CalendarDays className="h-4 w-4" />
                                Book Appointment
                            </Link>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
