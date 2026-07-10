"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { getClientIcon } from "./iconMap";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoServices({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const primary = client.colors.primary;

    return (
        <section id="services" className="section-padding bg-bg" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
                >
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${primary}18`, color: primary }}>
                            What we offer
                        </span>
                        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                            Complete care for every smile.
                        </h2>
                    </div>
                    <Link href={`/client-demo/${client.id}/services`} className="inline-flex items-center gap-2 text-sm font-bold no-underline" style={{ color: primary }}>
                        Explore all services
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {client.featuredServices.map((service, index) => {
                        const Icon = getClientIcon(service.icon);
                        return (
                            <motion.article
                                key={service.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={isInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ duration: 0.45, delay: index * 0.07 }}
                                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border-light bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[var(--shadow-elevated)]"
                            >
                                <div className="relative h-44 w-full overflow-hidden">
                                    <Image
                                        src={service.image ?? client.heroImage}
                                        alt={service.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div
                                        className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md"
                                        style={{ backgroundColor: client.colors?.primary ?? "var(--color-primary)" }}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="flex flex-1 flex-col p-7">
                                    <h3 className="text-2xl text-secondary">{service.name}</h3>
                                    <p className="mt-3 flex-1 text-sm leading-7 text-text-secondary">{service.description}</p>
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
