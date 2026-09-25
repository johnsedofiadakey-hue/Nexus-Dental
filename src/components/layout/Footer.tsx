import Link from "next/link";
import {
    ArrowUpRight,
    CalendarDays,
    HeartPulse,
    LockKeyhole,
    MessageCircle,
} from "lucide-react";

const links = [
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Virtual care", href: "/consultation" },
    { label: "Contact", href: "/contact" },
];

const patientLinks = [
    { label: "Book appointment", href: "/booking" },
    { label: "Patient portal", href: "/auth/patient" },
    { label: "Privacy", href: "/privacy" },
    { label: "Accessibility", href: "/accessibility" },
];

export default function Footer() {
    const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Nexus Dental";

    return (
        <footer className="bg-secondary text-white">
            <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-20">
                <div className="mb-14 grid gap-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:grid-cols-[1.2fr_auto] lg:items-center lg:p-10">
                    <div>
                        <span className="eyebrow !text-primary-light">Ready when you are</span>
                        <h2 className="mt-4 max-w-2xl font-[family-name:var(--font-heading)] text-3xl leading-tight sm:text-4xl">
                            A calmer dental visit starts with one simple booking.
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href="/contact" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10">
                            <MessageCircle className="h-4 w-4" />
                            Ask a question
                        </Link>
                        <Link href="/booking" className="btn-primary px-5 py-3 text-sm no-underline">
                            <CalendarDays className="h-4 w-4" />
                            Book appointment
                        </Link>
                    </div>
                </div>

                <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
                    <div className="max-w-md">
                        <div className="mb-5 flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                                <HeartPulse className="h-5 w-5" />
                            </span>
                            <span className="font-[family-name:var(--font-heading)] text-2xl">{clinicName}</span>
                        </div>
                        <p className="text-sm leading-7 text-slate-300">
                            Modern dental care with clear communication, thoughtful technology, and a gentle patient-first approach.
                        </p>
                        <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-light">
                            <LockKeyhole className="h-4 w-4" />
                            Private, consent-led care
                        </p>
                    </div>

                    <div>
                        <h3 className="mb-5 text-sm font-bold uppercase tracking-[0.14em] text-white">Explore</h3>
                        <ul className="m-0 grid list-none gap-3 p-0">
                            {links.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="inline-flex items-center gap-1 text-sm text-slate-300 no-underline hover:text-primary-light">
                                        {link.label}
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="mb-5 text-sm font-bold uppercase tracking-[0.14em] text-white">For patients</h3>
                        <ul className="m-0 grid list-none gap-3 p-0">
                            {patientLinks.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href} className="text-sm text-slate-300 no-underline hover:text-primary-light">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col gap-3 pt-7 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} {clinicName}. All rights reserved.</p>
                    <Link href="/auth/staff" className="text-slate-400 no-underline hover:text-primary-light">Staff sign in</Link>
                </div>
            </div>
        </footer>
    );
}
