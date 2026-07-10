"use client";

import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { HeartHandshake, ShieldCheck, Target } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoAbout({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const primary = client.colors.primary;

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="grid gap-12 lg:grid-cols-2 lg:items-center"
                >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[6px] border-white bg-black/5 shadow-xl">
                        <Image src="/client-demos/dentocdental/images/T6.jpg" alt={`${client.name} treatment room`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                    </div>

                    <div>
                        <span
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                            style={{ backgroundColor: `${primary}18`, color: primary }}
                        >
                            About us
                        </span>
                        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                            Who we are.
                        </h2>
                        <p className="mt-5 text-base leading-7 text-text-secondary">{client.aboutText}</p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-1">
                            <div className="flex gap-3 rounded-2xl border border-border-light p-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                                    <Target className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-secondary">Our Vision</p>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">{client.vision}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 rounded-2xl border border-border-light p-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                                    <HeartHandshake className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-secondary">Our Mission</p>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">{client.mission}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 rounded-2xl border border-border-light p-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                                    <ShieldCheck className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-secondary">Trusted care</p>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">1.5k+ patient reviews across {client.contact.branches.length} branches in Ghana.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
