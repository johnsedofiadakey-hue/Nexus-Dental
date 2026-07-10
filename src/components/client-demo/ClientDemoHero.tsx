"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, ExternalLink, Sparkles } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoHero({ client }: { client: ClientData }) {
    const reduceMotion = useReducedMotion();

    return (
        <section className="relative isolate overflow-hidden bg-[linear-gradient(135deg,#f8fcfb_0%,#ffffff_45%,#edf8f6_100%)]">
            <div className="absolute -left-36 top-24 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -right-24 bottom-0 -z-10 h-96 w-96 rounded-full bg-primary-light/15 blur-3xl" />

            <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-12 sm:px-6 sm:py-16 lg:min-h-[720px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8 lg:py-20">
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    className="relative z-10"
                >
                    <div className="mb-6 flex items-center gap-3">
                        <Image src={client.logo} alt={`${client.name} logo`} width={140} height={42} className="h-10 w-auto object-contain" />
                    </div>

                    <div className="eyebrow mb-5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                            <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        Client demo &middot; {client.name}
                    </div>

                    <h1
                        className="max-w-3xl font-[family-name:var(--font-heading)] text-[clamp(2.75rem,6vw,5.25rem)] leading-[0.98] tracking-[-0.04em]"
                        style={{ color: client.colors?.text ?? "var(--color-secondary)" }}
                    >
                        {client.tagline}
                    </h1>

                    <p className="mt-7 max-w-xl text-lg leading-8 text-text-secondary sm:text-xl">
                        {client.description}
                    </p>

                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                        <a
                            href="#services"
                            className="btn-primary min-h-14 w-full px-6 text-base no-underline sm:w-auto"
                            style={client.colors?.primary ? { backgroundColor: client.colors.primary, boxShadow: "none" } : undefined}
                        >
                            <CalendarDays className="h-5 w-5" />
                            View services
                            <ArrowRight className="h-4 w-4" />
                        </a>
                        <a
                            href={client.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary min-h-14 w-full bg-white/75 px-6 text-base no-underline sm:w-auto"
                        >
                            <ExternalLink className="h-5 w-5" />
                            Visit original site
                        </a>
                    </div>

                    <div className="mt-10 rounded-2xl border border-border-light bg-white/70 px-5 py-4 text-xs text-text-muted">
                        This is a design demo built by Nexus Dental, blending {client.name}&apos;s brand and content with our
                        platform&apos;s design system.
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
                            src={client.heroImage}
                            alt={`${client.name} treatment room`}
                            fill
                            priority
                            sizes="(max-width: 1024px) 100vw, 55vw"
                            className="object-cover object-[62%_center]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 via-transparent to-white/10" />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
