"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    Banknote,
    CalendarDays,
    Check,
    ChevronRight,
    CircleUserRound,
    ClipboardList,
    Clock3,
    FileText,
    HeartPulse,
    LayoutDashboard,
    Menu,
    MessageCircle,
    ReceiptText,
    ShieldCheck,
    Sparkles,
    Stethoscope,
    UsersRound,
    X,
} from "lucide-react";

type DemoView = "today" | "patient" | "treatment" | "billing" | "portal";

const navigation: Array<{
    id: DemoView;
    label: string;
    shortLabel: string;
    icon: typeof LayoutDashboard;
}> = [
    { id: "today", label: "Today", shortLabel: "Today", icon: LayoutDashboard },
    { id: "patient", label: "Patient 360", shortLabel: "Patient", icon: UsersRound },
    { id: "treatment", label: "Treatment plan", shortLabel: "Treatment", icon: ClipboardList },
    { id: "billing", label: "Billing", shortLabel: "Billing", icon: ReceiptText },
    { id: "portal", label: "Patient portal", shortLabel: "Portal", icon: CircleUserRound },
];

const appointments = [
    { time: "09:00", initials: "AK", name: "Ama K.", service: "Routine check-up", state: "Checked in" },
    { time: "10:30", initials: "KO", name: "Kwame O.", service: "Treatment review", state: "Confirmed" },
    { time: "12:00", initials: "EA", name: "Esi A.", service: "Dental cleaning", state: "Confirmed" },
    { time: "14:30", initials: "NY", name: "Nana Y.", service: "Consultation", state: "Pending" },
];

const treatmentItems = [
    { name: "Comprehensive examination", status: "Completed", amount: "GHS 350" },
    { name: "Professional cleaning", status: "Completed", amount: "GHS 420" },
    { name: "Composite restoration — 26", status: "Planned", amount: "GHS 780" },
    { name: "Review appointment", status: "Scheduled", amount: "GHS 200" },
];

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
                <strong className="text-2xl tracking-[-0.04em] text-[#0a2840] sm:text-3xl">{value}</strong>
                <span className="text-xs font-semibold text-[#0f9d8b]">{note}</span>
            </div>
        </div>
    );
}

function StatusPill({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full bg-[#daf7f1] px-2.5 py-1 text-[10px] font-bold text-[#08786c]">
            {children}
        </span>
    );
}

function TodayView({ onOpenPatient }: { onOpenPatient: () => void }) {
    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Monday · Clinic overview</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#0a2840] sm:text-3xl">
                        Good morning, Dr. Mensah
                    </h2>
                </div>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0f9d8b] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,157,139,.22)]">
                    <CalendarDays className="h-4 w-4" /> New appointment
                </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Today’s appointments" value="12" note="On schedule" />
                <Metric label="Patients waiting" value="3" note="Live" />
                <Metric label="Open treatment plans" value="8" note="Review" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.45fr_.8fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-extrabold text-[#0a2840]">Today’s schedule</h3>
                        <span className="text-xs font-bold text-[#0f9d8b]">View calendar</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {appointments.map((appointment, index) => (
                            <button
                                key={appointment.time}
                                onClick={index === 0 ? onOpenPatient : undefined}
                                className="grid w-full grid-cols-[42px_1fr_auto] items-center gap-3 py-3 text-left transition hover:bg-slate-50"
                            >
                                <span className="text-xs font-bold text-slate-500">{appointment.time}</span>
                                <span className="flex min-w-0 items-center gap-3">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e3f6f2] text-xs font-extrabold text-[#08786c]">
                                        {appointment.initials}
                                    </span>
                                    <span className="min-w-0">
                                        <b className="block truncate text-sm text-[#0a2840]">{appointment.name}</b>
                                        <small className="block truncate text-xs text-slate-500">{appointment.service}</small>
                                    </span>
                                </span>
                                <StatusPill>{appointment.state}</StatusPill>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-[#0a2840]">Today’s progress</h3>
                        <span className="text-xs font-bold text-[#0f9d8b]">Details</span>
                    </div>
                    <div className="mx-auto mt-7 grid h-36 w-36 place-items-center rounded-full bg-[conic-gradient(#12ad99_0_72%,#e4eeee_72%_100%)]">
                        <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-3xl font-black text-[#0a2840]">72%</div>
                    </div>
                    <div className="mt-7 grid grid-cols-2 gap-3 text-center text-xs text-slate-500">
                        <span className="rounded-xl bg-slate-50 p-3">Completed <b className="block text-lg text-[#0a2840]">8</b></span>
                        <span className="rounded-xl bg-slate-50 p-3">Remaining <b className="block text-lg text-[#0a2840]">4</b></span>
                    </div>
                </section>
            </div>
        </div>
    );
}

function PatientView({ onTreatment }: { onTreatment: () => void }) {
    return (
        <div>
            <div className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(130deg,#0b3850,#0f8e80)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-lg font-black">AK</span>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-teal-100">Patient profile</span>
                        <h2 className="mt-1 text-2xl font-extrabold">Ama K.</h2>
                        <p className="mt-1 text-sm text-teal-50/80">ND-00142 · Last visit 3 months ago</p>
                    </div>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-bold"><ShieldCheck className="h-4 w-4" /> Sample patient</span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-extrabold text-[#0a2840]">Patient summary</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                            ["Next appointment", "14 Oct · 9:00 AM", CalendarDays],
                            ["Active treatment", "Composite restoration", Stethoscope],
                            ["Documents", "7 files and scans", FileText],
                            ["Account balance", "GHS 780", Banknote],
                        ].map(([label, value, Icon]) => {
                            const ItemIcon = Icon as typeof CalendarDays;
                            return (
                                <div key={label as string} className="rounded-2xl bg-slate-50 p-4">
                                    <ItemIcon className="h-5 w-5 text-[#0f9d8b]" />
                                    <span className="mt-4 block text-xs font-semibold text-slate-500">{label as string}</span>
                                    <b className="mt-1 block text-sm text-[#0a2840]">{value as string}</b>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-extrabold text-[#0a2840]">Care timeline</h3>
                    <div className="mt-5 space-y-5 border-l-2 border-[#d7efeb] pl-5">
                        {[
                            ["Today", "Checked in for routine review"],
                            ["12 Jul", "Cleaning completed"],
                            ["04 Apr", "Treatment plan accepted"],
                        ].map(([date, note]) => (
                            <div key={date} className="relative">
                                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#0f9d8b] ring-2 ring-[#d7efeb]" />
                                <b className="text-xs text-[#0f9d8b]">{date}</b>
                                <p className="mt-1 text-sm font-semibold text-[#0a2840]">{note}</p>
                            </div>
                        ))}
                    </div>
                    <button onClick={onTreatment} className="mt-7 inline-flex w-full items-center justify-between rounded-xl bg-[#edf9f7] px-4 py-3 text-sm font-bold text-[#08786c]">
                        Open treatment plan <ChevronRight className="h-4 w-4" />
                    </button>
                </section>
            </div>
        </div>
    );
}

function TreatmentView({ onBilling }: { onBilling: () => void }) {
    return (
        <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Ama K. · TP-2026-014</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#0a2840] sm:text-3xl">Treatment plan</h2>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#daf7f1] px-3 py-2 text-xs font-bold text-[#08786c]"><Check className="h-4 w-4" /> Patient accepted</span>
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="hidden grid-cols-[1fr_140px_120px] bg-slate-50 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:grid">
                    <span>Procedure</span><span>Status</span><span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-slate-100">
                    {treatmentItems.map((item) => (
                        <div key={item.name} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_140px_120px] sm:items-center">
                            <b className="text-sm text-[#0a2840]">{item.name}</b>
                            <StatusPill>{item.status}</StatusPill>
                            <span className="text-sm font-extrabold text-[#0a2840] sm:text-right">{item.amount}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between bg-[#0a2840] px-5 py-5 text-white">
                    <span className="text-sm font-semibold text-slate-300">Estimated plan total</span>
                    <strong className="text-xl">GHS 1,750</strong>
                </div>
            </div>
            <button onClick={onBilling} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0f9d8b] px-5 text-sm font-bold text-white">
                Continue to billing <ArrowRight className="h-4 w-4" />
            </button>
        </div>
    );
}

function BillingView() {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Clinic finance</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#0a2840] sm:text-3xl">Billing without the guesswork</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Collected today" value="GHS 8,420" note="11 payments" />
                <Metric label="Outstanding" value="GHS 3,180" note="6 invoices" />
                <Metric label="Draft invoices" value="4" note="Review" />
            </div>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-[#0a2840]">Recent invoices</h3>
                    <span className="text-xs font-bold text-[#0f9d8b]">View all</span>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                    {[
                        ["INV-1024", "Ama K.", "GHS 780", "Part paid"],
                        ["INV-1023", "Kwame O.", "GHS 420", "Paid"],
                        ["INV-1022", "Esi A.", "GHS 350", "Paid"],
                    ].map(([invoice, patient, amount, state]) => (
                        <div key={invoice} className="grid grid-cols-[1fr_auto] gap-3 py-4 sm:grid-cols-[110px_1fr_120px_90px] sm:items-center">
                            <b className="text-xs text-slate-500">{invoice}</b>
                            <span className="text-sm font-bold text-[#0a2840]">{patient}</span>
                            <strong className="text-sm text-[#0a2840]">{amount}</strong>
                            <StatusPill>{state}</StatusPill>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

function PortalView() {
    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_330px] lg:items-center">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Connected patient experience</p>
                <h2 className="mt-2 max-w-xl text-3xl font-extrabold tracking-[-0.045em] text-[#0a2840] sm:text-4xl">The patient sees what matters—without calling the front desk.</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                        [CalendarDays, "Appointments", "Upcoming visits and reminders"],
                        [FileText, "Records", "Care documents in one place"],
                        [ClipboardList, "Treatment", "Plan status and next steps"],
                        [MessageCircle, "Messages", "A clear line to the clinic"],
                    ].map(([Icon, title, description]) => {
                        const ItemIcon = Icon as typeof CalendarDays;
                        return (
                            <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <ItemIcon className="h-5 w-5 text-[#0f9d8b]" />
                                <b className="mt-4 block text-sm text-[#0a2840]">{title as string}</b>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{description as string}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="mx-auto w-[290px] rounded-[2.7rem] border-[8px] border-[#071f34] bg-[#f4fbfa] p-3 shadow-[0_35px_80px_rgba(7,31,52,.3)]">
                <div className="rounded-[2rem] bg-[linear-gradient(145deg,#0b4254,#0c8d80)] px-5 pb-6 pt-9 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-teal-100">Nexus Patient</span>
                    <h3 className="mt-5 text-2xl font-extrabold">Hello, Ama</h3>
                    <p className="mt-1 text-xs text-teal-100">Your care, appointments and records.</p>
                </div>
                <div className="-mt-3 rounded-2xl bg-white p-4 shadow-lg">
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Next appointment</span>
                    <b className="mt-2 block text-sm text-[#0a2840]">Routine check-up</b>
                    <span className="text-[10px] text-slate-500">14 Oct · 9:00 AM</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-4">
                    {['Appointments', 'My records', 'Treatment', 'Messages'].map((item) => (
                        <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-[10px] font-bold text-[#0a2840]">
                            <span className="mb-3 block h-7 w-7 rounded-lg bg-[#ddf6f1]" />{item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function NexusDentalInteractiveDemo({ initialView = "today" }: { initialView?: DemoView }) {
    const [view, setView] = useState<DemoView>(initialView);
    const [menuOpen, setMenuOpen] = useState(false);

    const active = navigation.find((item) => item.id === view)!;

    return (
        <main className="min-h-screen bg-[#edf5f4] text-[#0a2840]">
            <div className="border-b border-white/10 bg-[#071f34] text-white">
                <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#14aa99]"><HeartPulse className="h-5 w-5" /></span>
                        <div className="min-w-0">
                            <b className="block truncate text-sm">Nexus Dental</b>
                            <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-slate-400">Interactive product tour</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-2 text-xs font-bold text-teal-100 sm:inline-flex"><Sparkles className="h-3.5 w-3.5" /> Sample data only</span>
                        <Link href="https://stormglide.io/contact" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#5be0cf] px-4 text-xs font-extrabold text-[#052d2a] no-underline sm:text-sm">
                            Book a demo <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>

            <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#08786c] shadow-sm"><ShieldCheck className="h-4 w-4" /> Safe, read-only walkthrough</span>
                        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-[#071f34] sm:text-5xl">Experience a connected clinic in a few clicks.</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Follow a sample patient from check-in to treatment and billing. Nothing here connects to a real clinic or real patient record.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e0f6f2] text-[#08786c]"><Clock3 className="h-5 w-5" /></span>
                        <span className="pr-3 text-xs text-slate-500"><b className="block text-sm text-[#0a2840]">2-minute tour</b>No account required</span>
                    </div>
                </div>

                <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(7,31,52,.14)] lg:grid lg:min-h-[680px] lg:grid-cols-[230px_1fr]">
                    <aside className="hidden bg-[#08253d] p-5 text-white lg:block">
                        <div className="mb-8 flex items-center gap-3 border-b border-white/10 pb-5">
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#14aa99] text-xs font-black">ND</span>
                            <div><b className="block text-sm">Aster Dental</b><span className="text-[10px] text-slate-400">Demo clinic</span></div>
                        </div>
                        <p className="mb-3 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Guided tour</p>
                        <nav className="space-y-1" aria-label="Demo sections">
                            {navigation.map((item, index) => (
                                <button key={item.id} onClick={() => setView(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${view === item.id ? 'bg-[#14aa99]/20 text-[#6fe8da]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                                    <span className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] ${view === item.id ? 'bg-[#14aa99] text-white' : 'bg-white/5 text-slate-400'}`}>{index + 1}</span>
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <ShieldCheck className="h-5 w-5 text-[#6fe8da]" />
                            <b className="mt-3 block text-xs">This is a simulation</b>
                            <p className="mt-1 text-[11px] leading-5 text-slate-400">All names, records and amounts are fictional.</p>
                        </div>
                    </aside>

                    <section className="min-w-0 bg-[#f5f9f8]">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
                            <button onClick={() => setMenuOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"><Menu className="h-4 w-4" /> Tour menu</button>
                            <span className="text-xs font-extrabold text-[#08786c]">{active.label}</span>
                        </div>
                        <div className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
                            <AnimatePresence mode="wait">
                                <motion.div key={view} initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                                    {view === "today" && <TodayView onOpenPatient={() => setView("patient")} />}
                                    {view === "patient" && <PatientView onTreatment={() => setView("treatment")} />}
                                    {view === "treatment" && <TreatmentView onBilling={() => setView("billing")} />}
                                    {view === "billing" && <BillingView />}
                                    {view === "portal" && <PortalView />}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </section>
                </div>
            </section>

            <div className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-[0_16px_45px_rgba(7,31,52,.2)] backdrop-blur-xl lg:hidden">
                {navigation.map((item) => (
                    <button key={item.id} onClick={() => setView(item.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${view === item.id ? 'bg-[#e0f6f2] text-[#08786c]' : 'text-slate-500'}`}>
                        <item.icon className="h-4 w-4" /> {item.shortLabel}
                    </button>
                ))}
            </div>

            <AnimatePresence>
                {menuOpen && (
                    <>
                        <motion.button aria-label="Close tour menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-50 bg-[#071f34]/45 backdrop-blur-sm lg:hidden" />
                        <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 28, stiffness: 280 }} className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-sm bg-[#08253d] p-5 text-white lg:hidden">
                            <div className="flex items-center justify-between">
                                <div><b className="block">Nexus Dental</b><span className="text-xs text-slate-400">Interactive tour</span></div>
                                <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><X className="h-5 w-5" /></button>
                            </div>
                            <nav className="mt-8 space-y-2">
                                {navigation.map((item, index) => (
                                    <button key={item.id} onClick={() => { setView(item.id); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold ${view === item.id ? 'bg-[#14aa99]/20 text-[#6fe8da]' : 'text-slate-300'}`}>
                                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-xs">{index + 1}</span>{item.label}
                                    </button>
                                ))}
                            </nav>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </main>
    );
}
