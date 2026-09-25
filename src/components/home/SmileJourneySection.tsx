"use client";

import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { CalendarCheck, ClipboardCheck, ScanSearch, Sparkles } from "lucide-react";

const steps = [
    { icon: ScanSearch, title: "Understand", text: "A careful assessment and clear explanation of what we see." },
    { icon: ClipboardCheck, title: "Plan", text: "Options, expected costs, and priorities collected in one plan." },
    { icon: Sparkles, title: "Treat", text: "Comfort-led care with every visit connected to your record." },
    { icon: CalendarCheck, title: "Follow up", text: "Reminders, results, and next steps stay easy to find." },
];

export default function SmileJourneySection() {
    const ref = useRef(null);
    const visible = useInView(ref, { once: true, margin: "-80px" });
    const reduceMotion = useReducedMotion();

    return (
        <section ref={ref} className="section-padding overflow-hidden bg-white">
            <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
                <motion.div initial={reduceMotion ? false : { opacity: 0, x: -24 }} animate={visible ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.65 }} className="relative">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[var(--shadow-hero)]">
                        <Image src="/images/digital-diagnostics.jpg" alt="Dentist explaining a digital dental X-ray to a patient" fill sizes="(max-width: 1024px) 100vw, 52vw" className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-secondary/30 via-transparent to-transparent" />
                    </div>
                    <motion.div animate={reduceMotion ? undefined : { y: [0, -7, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-5 right-4 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur sm:right-8">
                        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ScanSearch className="h-5 w-5" /></span><div><p className="text-sm font-bold text-secondary">See it clearly</p><p className="text-xs text-text-muted">Understand before deciding</p></div></div>
                    </motion.div>
                </motion.div>

                <motion.div initial={reduceMotion ? false : { opacity: 0, y: 22 }} animate={visible ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.1 }}>
                    <span className="eyebrow">Your care journey</span>
                    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.03em] text-secondary sm:text-5xl">From first scan to follow-up, nothing feels disconnected.</h2>
                    <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary">Every department works from the same patient story, helping you understand what happened, what comes next, and who to contact.</p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {steps.map((step, index) => <motion.article key={step.title} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={visible ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, delay: 0.18 + index * 0.08 }} className="rounded-2xl border border-border-light bg-bg/60 p-4"><div className="mb-3 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><step.icon className="h-4 w-4" /></span><h3 className="text-lg text-secondary">{step.title}</h3></div><p className="text-sm leading-6 text-text-secondary">{step.text}</p></motion.article>)}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
