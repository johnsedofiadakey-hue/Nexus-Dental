"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    Clock3,
    HeartHandshake,
    ShieldCheck,
    Stethoscope,
    Video,
} from "lucide-react";

const assurances = [
    { icon: ShieldCheck, label: "Clear treatment plans" },
    { icon: HeartHandshake, label: "Gentle, patient-first care" },
    { icon: Clock3, label: "Easy online booking" },
];

export default function HeroSection() {
    const reduceMotion = useReducedMotion();

    return (
        <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,#f8fcfb_0%,#ffffff_45%,#edf8f6_100%)]">
            <div className="absolute -left-36 top-24 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -right-24 bottom-0 -z-10 h-96 w-96 rounded-full bg-primary-light/15 blur-3xl" />

            <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-12 sm:px-6 sm:py-16 lg:min-h-[760px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8 lg:py-20">
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    className="relative z-10"
                >
                    <div className="eyebrow mb-5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                            <Stethoscope className="h-3.5 w-3.5" />
                        </span>
                        Modern care, made personal
                    </div>

                    <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-[clamp(3.35rem,7vw,6.25rem)] leading-[0.94] tracking-[-0.04em] text-secondary">
                        Healthy smiles
                        <span className="mt-2 block text-primary">start here.</span>
                    </h1>

                    <p className="mt-7 max-w-xl text-lg leading-8 text-text-secondary sm:text-xl">
                        Thoughtful dentistry, modern technology, and a calm approach—so every visit feels clear, comfortable, and centred on you.
                    </p>

                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                        <Link href="/booking" className="btn-primary min-h-14 w-full px-6 text-base no-underline sm:w-auto">
                            <CalendarDays className="h-5 w-5" />
                            Book appointment
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/consultation" className="btn-secondary min-h-14 w-full bg-white/75 px-6 text-base no-underline sm:w-auto">
                            <Video className="h-5 w-5" />
                            Online consultation
                        </Link>
                    </div>

                    <div className="mt-10 grid gap-3 border-t border-border pt-7 sm:grid-cols-3">
                        {assurances.map((item) => (
                            <div key={item.label} className="flex items-center gap-2.5 text-sm font-semibold text-secondary">
                                <item.icon className="h-5 w-5 shrink-0 text-primary" />
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.97, x: 18 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.12, ease: "easeOut" }}
                    className="relative mx-auto w-full max-w-2xl lg:mx-0"
                >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[6px] border-white bg-white shadow-[var(--shadow-hero)] sm:rounded-[2.5rem] lg:aspect-[1.02/1]">
                        <Image
                            src="/images/clinic-hero.jpg"
                            alt="Bright modern dental treatment room with a teal dental chair and diagnostic equipment"
                            fill
                            priority
                            sizes="(max-width: 1024px) 100vw, 55vw"
                            className="object-cover object-[62%_center]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 via-transparent to-white/10" />
                    </div>

                    <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.45 }}
                        className="surface-card absolute left-3 top-3 flex items-center gap-3 rounded-2xl p-3 sm:left-5 sm:top-6 sm:p-4"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-12 sm:w-12">
                            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                        </span>
                        <div>
                            <p className="text-sm font-bold text-secondary">Comfort-led care</p>
                            <p className="hidden text-xs text-text-muted sm:block">Your questions come first</p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.85, duration: 0.45 }}
                        className="surface-card absolute bottom-3 right-3 flex items-center gap-3 rounded-2xl p-3 sm:bottom-5 sm:right-5 sm:p-4"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent sm:h-12 sm:w-12">
                            <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
                        </span>
                        <div>
                            <p className="text-sm font-bold text-secondary">Booking made simple</p>
                            <p className="hidden text-xs text-text-muted sm:block">Choose a time that works</p>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
