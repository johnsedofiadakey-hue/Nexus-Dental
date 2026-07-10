"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Building2, Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoContactPage({ client }: { client: ClientData }) {
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
                    className="mb-12 max-w-2xl"
                >
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${primary}18`, color: primary }}>
                        Contact us
                    </span>
                    <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                        We&apos;d love to see you.
                    </h1>
                </motion.div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-3xl border border-border-light p-6">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                            <Phone className="h-5 w-5" />
                        </span>
                        <p className="mt-4 text-sm font-bold text-secondary">Call us</p>
                        <p className="mt-1 text-sm text-text-secondary">{client.contact.phone}</p>
                    </div>
                    <div className="rounded-3xl border border-border-light p-6">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                            <Mail className="h-5 w-5" />
                        </span>
                        <p className="mt-4 text-sm font-bold text-secondary">Email us</p>
                        <p className="mt-1 text-sm text-text-secondary">{client.contact.email}</p>
                    </div>
                    <div className="rounded-3xl border border-border-light p-6">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                            <MapPin className="h-5 w-5" />
                        </span>
                        <p className="mt-4 text-sm font-bold text-secondary">Head office</p>
                        <p className="mt-1 text-sm text-text-secondary">{client.contact.address}</p>
                    </div>
                </div>

                <div className="mt-12">
                    <h2 className="mb-6 text-xl font-bold text-secondary">Our branches</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {client.contact.branches.map((branch) => (
                            <div key={branch.name} className="flex items-center gap-3 rounded-2xl bg-bg p-5">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${primary}18`, color: primary }}>
                                    <Building2 className="h-5 w-5" />
                                </span>
                                <p className="text-sm font-semibold text-secondary">{branch.name}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {client.contact.social && (
                    <div className="mt-12 flex gap-3">
                        {client.contact.social.facebook && (
                            <a href={client.contact.social.facebook} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg text-secondary transition-colors hover:bg-border-light" aria-label="Facebook">
                                <Facebook className="h-5 w-5" />
                            </a>
                        )}
                        {client.contact.social.instagram && (
                            <a href={client.contact.social.instagram} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg text-secondary transition-colors hover:bg-border-light" aria-label="Instagram">
                                <Instagram className="h-5 w-5" />
                            </a>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
