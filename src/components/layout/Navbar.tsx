"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone, Calendar } from "lucide-react";

const navLinks = [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Consultation", href: "/consultation" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? "glass shadow-[var(--shadow-card)]"
                : "bg-transparent"
                }`}
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-20 items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 no-underline">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                            <span className="text-lg font-bold text-white">N</span>
                        </div>
                        <div>
                            <span className="font-[family-name:var(--font-heading)] text-xl text-secondary">
                                Nexus
                            </span>
                            <span className="font-[family-name:var(--font-heading)] text-xl text-primary ml-1">
                                Dental
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden lg:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors no-underline"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Desktop Actions */}
                    <div className="hidden lg:flex items-center gap-4">
                        <Link href="/auth/patient" className="text-sm font-semibold text-secondary hover:text-primary transition-colors no-underline px-4">
                            Sign In
                        </Link>
                        <a
                            href="tel:+1234567890"
                            className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-primary transition-colors no-underline"
                        >
                            <Phone className="h-4 w-4" />
                            <span>Emergency</span>
                        </a>
                        <Link href="/booking" className="btn-primary text-sm no-underline">
                            <Calendar className="h-4 w-4" />
                            Book Appointment
                        </Link>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-bg-white border border-border text-secondary"
                        aria-label="Toggle menu"
                    >
                        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm lg:hidden"
                            onClick={() => setIsOpen(false)}
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 bottom-0 w-80 bg-bg-white shadow-hero lg:hidden z-50"
                        >
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between p-6 border-b border-border">
                                    <span className="font-[family-name:var(--font-heading)] text-lg text-secondary">
                                        Menu
                                    </span>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg border border-border text-secondary"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <nav className="flex flex-col p-6 gap-1">
                                    {navLinks.map((link, i) => (
                                        <motion.div
                                            key={link.href}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <Link
                                                href={link.href}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg hover:text-primary transition-colors no-underline"
                                            >
                                                {link.label}
                                            </Link>
                                        </motion.div>
                                    ))}
                                </nav>
                                <div className="mt-auto p-6 border-t border-border">
                                    <Link
                                        href="/booking"
                                        onClick={() => setIsOpen(false)}
                                        className="btn-primary w-full text-sm no-underline"
                                    >
                                        <Calendar className="h-4 w-4" />
                                        Book Appointment
                                    </Link>
                                    <a
                                        href="tel:+1234567890"
                                        className="flex items-center justify-center gap-2 mt-3 py-3 text-sm font-medium text-text-secondary no-underline"
                                    >
                                        <Phone className="h-4 w-4" />
                                        Emergency: (123) 456-7890
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
}
