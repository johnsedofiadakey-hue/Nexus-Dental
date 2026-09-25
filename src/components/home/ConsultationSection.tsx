"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
    ArrowRight,
    CalendarCheck2,
    Camera,
    ClipboardCheck,
    LockKeyhole,
    Video,
} from "lucide-react";

const steps = [
    { icon: ClipboardCheck, title: "Share your concern", text: "Complete a short assessment before the call." },
    { icon: Camera, title: "Meet securely online", text: "Speak with the care team from a private space." },
    { icon: CalendarCheck2, title: "Plan the next step", text: "Know whether you need an in-clinic examination." },
];

export default function ConsultationSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#e7f7f4,#f7fbfa)] p-6 sm:p-10"
                >
                    <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[32px] border-white/60" />
                    <div className="relative rounded-[1.75rem] border border-white bg-white/85 p-6 shadow-[var(--shadow-card)] backdrop-blur sm:p-8">
                        <div className="flex items-center justify-between border-b border-border-light pb-5">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                                    <Video className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="font-bold text-secondary">Virtual dental care</p>
                                    <p className="text-xs text-text-muted">Private consultation</p>
                                </div>
                            </div>
                            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Available
                            </span>
                        </div>
                        <div className="mt-6 grid gap-4">
                            {steps.map((step, index) => (
                                <div key={step.title} className="flex gap-4 rounded-2xl bg-bg p-4">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                                        <step.icon className="h-4.5 w-4.5" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-bold text-secondary">{index + 1}. {step.title}</p>
                                        <p className="mt-1 text-xs leading-5 text-text-secondary">{step.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-text-secondary">
                            <LockKeyhole className="h-4 w-4 text-primary" />
                            Consent-led and designed for private conversations
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <span className="eyebrow">Virtual care</span>
                    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] text-secondary sm:text-5xl">
                        Professional guidance, wherever you are.
                    </h2>
                    <p className="mt-6 text-base leading-8 text-text-secondary sm:text-lg">
                        An online consultation can help you explain a concern, understand urgency, and prepare for an in-person visit. It does not replace a physical examination when one is clinically necessary.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Link href="/consultation" className="btn-primary min-h-13 px-6 no-underline">
                            Learn about virtual care
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/booking" className="btn-secondary min-h-13 px-6 no-underline">
                            Book a visit
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
