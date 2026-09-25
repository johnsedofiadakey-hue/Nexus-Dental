import Link from "next/link";
import {
    ArrowRight,
    CalendarDays,
    CircleUserRound,
    MessageCircle,
    ShieldAlert,
    Video,
} from "lucide-react";

const routes = [
    {
        icon: CalendarDays,
        title: "Book a clinic visit",
        text: "Choose a service, clinician, date, and available time online.",
        label: "Book appointment",
        href: "/booking",
    },
    {
        icon: Video,
        title: "Ask about virtual care",
        text: "Learn when an online consultation may help and when an examination is still needed.",
        label: "View virtual care",
        href: "/consultation",
    },
    {
        icon: CircleUserRound,
        title: "Existing patient support",
        text: "Access appointments, records, messages, and prescriptions from your patient portal.",
        label: "Open patient portal",
        href: "/auth/patient",
    },
];

export default function ContactPage() {
    return (
        <div className="bg-white">
            <section className="relative overflow-hidden bg-[linear-gradient(135deg,#f7fbfa,#edf8f6)] px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[42px] border-white/60" />
                <div className="relative mx-auto max-w-4xl text-center">
                    <span className="eyebrow">Get in touch</span>
                    <h1 className="mt-5 font-[family-name:var(--font-heading)] text-5xl leading-tight tracking-[-0.035em] text-secondary sm:text-6xl">
                        Start with the kind of help you need.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-secondary">
                        Whether you are booking your first visit, exploring virtual care, or managing an existing appointment, the right path is below.
                    </p>
                </div>
            </section>

            <section className="section-padding">
                <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
                    {routes.map((route) => (
                        <article key={route.title} className="surface-card flex flex-col rounded-3xl p-7">
                            <span className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <route.icon className="h-7 w-7" />
                            </span>
                            <h2 className="text-2xl text-secondary">{route.title}</h2>
                            <p className="mt-3 flex-1 text-sm leading-7 text-text-secondary">{route.text}</p>
                            <Link href={route.href} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary-dark no-underline">
                                {route.label}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            <section className="px-5 pb-16 sm:px-6 lg:px-8 lg:pb-24">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] bg-secondary p-7 text-white sm:p-9 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-primary-light">
                            <ShieldAlert className="h-6 w-6" />
                        </span>
                        <div>
                            <h2 className="text-2xl text-white">Dental emergency?</h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                Severe swelling, uncontrolled bleeding, facial trauma, or breathing difficulty may require immediate emergency medical care. For other urgent dental concerns, begin with an urgent-care booking.
                            </p>
                        </div>
                    </div>
                    <Link href="/services#emergency" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-secondary no-underline">
                        <MessageCircle className="h-4 w-4" />
                        Urgent care guidance
                    </Link>
                </div>
            </section>
        </div>
    );
}
