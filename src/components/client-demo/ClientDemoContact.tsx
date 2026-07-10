"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoContact({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section className="section-padding bg-secondary" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="grid gap-10 lg:grid-cols-2 lg:items-center"
                >
                    <div>
                        <span className="eyebrow bg-white/10 text-white">Get in touch</span>
                        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] text-white sm:text-5xl">
                            Visit {client.name}.
                        </h2>
                        <p className="mt-5 max-w-lg text-base leading-7 text-white/70">{client.mission}</p>
                    </div>

                    <div className="grid gap-4">
                        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-5">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                                <MapPin className="h-5 w-5" />
                            </span>
                            <p className="text-sm text-white/85">{client.contact.address}</p>
                        </div>
                        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-5">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                                <Phone className="h-5 w-5" />
                            </span>
                            <p className="text-sm text-white/85">{client.contact.phone}</p>
                        </div>
                        <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-5">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                                <Mail className="h-5 w-5" />
                            </span>
                            <p className="text-sm text-white/85">{client.contact.email}</p>
                        </div>
                        {client.contact.social && (
                            <div className="flex gap-3 pt-2">
                                {client.contact.social.facebook && (
                                    <a
                                        href={client.contact.social.facebook}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
                                        aria-label="Facebook"
                                    >
                                        <Facebook className="h-5 w-5" />
                                    </a>
                                )}
                                {client.contact.social.instagram && (
                                    <a
                                        href={client.contact.social.instagram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
                                        aria-label="Instagram"
                                    >
                                        <Instagram className="h-5 w-5" />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
