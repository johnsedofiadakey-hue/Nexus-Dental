"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    CalendarDays,
    CircleUserRound,
    HeartPulse,
    Menu,
    MessageCircle,
    Stethoscope,
    X,
} from "lucide-react";

const navLinks = [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "About", href: "/about" },
    { label: "Virtual care", href: "/consultation" },
    { label: "Contact", href: "/contact" },
    { label: "Client Demo", href: "/client-demo" },
];

export default function Navbar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Nexus Dental";

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 12);
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <header
            className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
                scrolled
                    ? "border-border-light bg-white/95 shadow-[var(--shadow-soft)] backdrop-blur-xl"
                    : "border-transparent bg-white/80 backdrop-blur-md"
            }`}
        >
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex min-w-0 items-center gap-3 no-underline" aria-label={`${clinicName} home`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_22px_rgba(15,157,139,0.22)]">
                        <HeartPulse className="h-5 w-5" />
                    </span>
                    <span className="truncate font-[family-name:var(--font-heading)] text-xl text-secondary sm:text-2xl">
                        {clinicName}
                    </span>
                </Link>

                <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`relative py-2 text-sm font-semibold no-underline transition-colors ${
                                isActive(link.href) ? "text-primary-dark" : "text-text-secondary hover:text-secondary"
                            }`}
                        >
                            {link.label}
                            {isActive(link.href) && (
                                <span className="absolute inset-x-0 -bottom-1 mx-auto h-0.5 w-6 rounded-full bg-primary" />
                            )}
                        </Link>
                    ))}
                </nav>

                <div className="hidden items-center gap-3 lg:flex">
                    <Link
                        href="/auth/patient"
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-secondary no-underline transition-colors hover:bg-bg hover:text-primary-dark"
                    >
                        <CircleUserRound className="h-4 w-4" />
                        Patient portal
                    </Link>
                    <Link href="/booking" className="btn-primary px-5 py-3 text-sm no-underline">
                        <CalendarDays className="h-4 w-4" />
                        Book appointment
                    </Link>
                </div>

                <div className="flex items-center gap-2 lg:hidden">
                    <Link
                        href="/booking"
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white no-underline shadow-sm"
                        aria-label="Book an appointment"
                    >
                        <CalendarDays className="h-4 w-4" />
                        <span className="hidden min-[390px]:inline">Book</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setIsOpen((open) => !open)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-secondary"
                        aria-expanded={isOpen}
                        aria-controls="mobile-navigation"
                        aria-label={isOpen ? "Close menu" : "Open menu"}
                    >
                        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Close menu"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 top-20 bg-secondary/20 backdrop-blur-sm lg:hidden"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            id="mobile-navigation"
                            initial={{ opacity: 0, y: -14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -14 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-x-3 top-[5.4rem] overflow-hidden rounded-3xl border border-border-light bg-white shadow-[var(--shadow-hero)] lg:hidden"
                        >
                            <nav className="grid gap-1 p-3" aria-label="Mobile navigation">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`rounded-2xl px-4 py-3 text-sm font-semibold no-underline ${
                                            isActive(link.href) ? "bg-primary/10 text-primary-dark" : "text-secondary hover:bg-bg"
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>
                            <div className="grid grid-cols-2 gap-3 border-t border-border-light bg-bg/70 p-4">
                                <Link
                                    href="/auth/patient"
                                    onClick={() => setIsOpen(false)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-sm font-semibold text-secondary no-underline"
                                >
                                    <CircleUserRound className="h-4 w-4" />
                                    Portal
                                </Link>
                                <Link
                                    href="/contact"
                                    onClick={() => setIsOpen(false)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-sm font-semibold text-secondary no-underline"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    Get help
                                </Link>
                                <Link
                                    href="/services"
                                    onClick={() => setIsOpen(false)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-sm font-semibold text-secondary no-underline"
                                >
                                    <Stethoscope className="h-4 w-4" />
                                    Services
                                </Link>
                                <Link href="/booking" onClick={() => setIsOpen(false)} className="btn-primary px-3 py-3 text-sm no-underline">
                                    <CalendarDays className="h-4 w-4" />
                                    Book now
                                </Link>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
}
