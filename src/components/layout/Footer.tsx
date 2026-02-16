import Link from "next/link";
import {
    MapPin,
    Phone,
    Mail,
    Clock,
    Facebook,
    Instagram,
    Twitter,
} from "lucide-react";

const quickLinks = [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about" },
    { label: "Our Services", href: "/services" },
    { label: "Book Appointment", href: "/booking" },
    { label: "Online Consultation", href: "/consultation" },
    { label: "Contact", href: "/contact" },
];

const services = [
    { label: "General Dentistry", href: "/services#general" },
    { label: "Cosmetic Dentistry", href: "/services#cosmetic" },
    { label: "Orthodontics", href: "/services#orthodontics" },
    { label: "Restorative & Surgical", href: "/services#restorative" },
    { label: "Pediatric Dentistry", href: "/services#pediatric" },
    { label: "Emergency Care", href: "/services#emergency" },
];

export default function Footer() {
    return (
        <footer className="bg-secondary text-white">
            {/* Main Footer */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                    {/* Brand Column */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                                <span className="text-lg font-bold text-white">N</span>
                            </div>
                            <div>
                                <span className="font-[family-name:var(--font-heading)] text-xl text-white">
                                    Nexus
                                </span>
                                <span className="font-[family-name:var(--font-heading)] text-xl text-primary-light ml-1">
                                    Dental
                                </span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">
                            Modern, painless dentistry delivered with precision, comfort, and
                            care. Your smile is our mission.
                        </p>
                        <div className="flex gap-3">
                            {[Facebook, Instagram, Twitter].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary-light hover:bg-primary transition-colors text-slate-400 hover:text-white no-underline"
                                >
                                    <Icon className="h-4 w-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-[family-name:var(--font-heading)] text-lg mb-6">
                            Quick Links
                        </h4>
                        <ul className="space-y-3 list-none p-0 m-0">
                            {quickLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-slate-400 hover:text-primary-light transition-colors no-underline"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Services */}
                    <div>
                        <h4 className="font-[family-name:var(--font-heading)] text-lg mb-6">
                            Our Services
                        </h4>
                        <ul className="space-y-3 list-none p-0 m-0">
                            {services.map((service) => (
                                <li key={service.href}>
                                    <Link
                                        href={service.href}
                                        className="text-sm text-slate-400 hover:text-primary-light transition-colors no-underline"
                                    >
                                        {service.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="font-[family-name:var(--font-heading)] text-lg mb-6">
                            Contact Us
                        </h4>
                        <ul className="space-y-4 list-none p-0 m-0">
                            <li className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-primary-light mt-0.5 shrink-0" />
                                <span className="text-sm text-slate-400">
                                    123 Dental Avenue, Suite 100
                                    <br />
                                    New York, NY 10001
                                </span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-primary-light shrink-0" />
                                <a
                                    href="tel:+1234567890"
                                    className="text-sm text-slate-400 hover:text-primary-light transition-colors no-underline"
                                >
                                    (123) 456-7890
                                </a>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-primary-light shrink-0" />
                                <a
                                    href="mailto:info@nexusdental.com"
                                    className="text-sm text-slate-400 hover:text-primary-light transition-colors no-underline"
                                >
                                    info@nexusdental.com
                                </a>
                            </li>
                            <li className="flex items-start gap-3">
                                <Clock className="h-5 w-5 text-primary-light mt-0.5 shrink-0" />
                                <span className="text-sm text-slate-400">
                                    Mon – Fri: 8:00 AM – 6:00 PM
                                    <br />
                                    Sat: 9:00 AM – 2:00 PM
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">
                        © {new Date().getFullYear()} Nexus Dental. All rights reserved.
                    </p>
                    <div className="flex flex-wrap items-center gap-6">
                        <Link href="/auth/staff" className="text-secondary/60 hover:text-secondary text-sm font-medium flex items-center gap-2 transition-all group no-underline">
                            <div className="h-1.5 w-1.5 rounded-full bg-secondary/30 group-hover:bg-primary transition-colors" />
                            Staff Access
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
