"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, CalendarDays, MessageCircle } from "lucide-react";

export default function CTASection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section className="section-padding bg-bg" ref={ref}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] bg-[linear-gradient(120deg,#0f9d8b_0%,#087466_55%,#102a43_100%)] px-6 py-14 text-center text-white shadow-[var(--shadow-hero)] sm:px-12 sm:py-20"
            >
                <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full border border-white/10" />
                <div className="absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-white/[0.06]" />
                <div className="relative mx-auto max-w-3xl">
                    <span className="eyebrow !text-white/80">Your next visit</span>
                    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight sm:text-5xl lg:text-6xl">
                        Let’s make dental care feel easier.
                    </h2>
                    <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
                        Choose an appointment time online or speak with the team if you are unsure where to begin.
                    </p>
                    <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                        <Link href="/booking" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-bold text-primary-dark no-underline transition-transform hover:-translate-y-0.5">
                            <CalendarDays className="h-5 w-5" />
                            Book appointment
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/contact" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/20 px-6 text-base font-bold text-white no-underline hover:bg-white/10">
                            <MessageCircle className="h-5 w-5" />
                            Ask a question
                        </Link>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
