"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import type { ClientData } from "@/lib/client-demo/config";
import { getClientIcon } from "./iconMap";

export default function ClientDemoServiceCatalog({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const primary = client.colors.primary;

    return (
        <section className="section-padding bg-bg" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                {client.serviceCategories.map((category, catIndex) => (
                    <div key={category.id} className={catIndex > 0 ? "mt-16" : ""}>
                        <motion.h2
                            initial={{ opacity: 0, y: 14 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: catIndex * 0.05 }}
                            className="mb-8 font-[family-name:var(--font-heading)] text-3xl tracking-[-0.02em] sm:text-4xl"
                            style={{ color: client.colors.text }}
                        >
                            {category.label}
                        </motion.h2>
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {category.services.map((service, index) => {
                                const Icon = getClientIcon(service.icon);
                                return (
                                    <motion.article
                                        key={service.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                                        transition={{ duration: 0.4, delay: index * 0.05 }}
                                        className="flex h-full flex-col rounded-3xl border border-border-light bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                                    >
                                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-secondary">{service.name}</h3>
                                        <p className="mt-2 flex-1 text-sm leading-6 text-text-secondary">{service.description}</p>
                                    </motion.article>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
