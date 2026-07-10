"use client";

import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { getClientIcon } from "./iconMap";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoComfort({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const primary = client.colors.primary;

    return (
        <section className="section-padding bg-bg" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="grid gap-12 lg:grid-cols-2 lg:items-center"
                >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[6px] border-white bg-black/5 shadow-xl">
                        <Image src="/client-demos/dentocdental/images/T7.jpg" alt={`Inside ${client.name}`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                    </div>

                    <div>
                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${primary}18`, color: primary }}>
                            Why patients choose us
                        </span>
                        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                            A calmer visit, from start to finish.
                        </h2>
                        <p className="mt-5 text-base leading-7 text-text-secondary">{client.comfortIntro}</p>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            {client.comfortFeatures.map((feature) => {
                                const Icon = getClientIcon(feature.icon);
                                return (
                                    <div key={feature.id} className="rounded-2xl border border-border-light bg-white p-5 text-center">
                                        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <p className="mt-3 text-sm font-bold text-secondary">{feature.title}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
