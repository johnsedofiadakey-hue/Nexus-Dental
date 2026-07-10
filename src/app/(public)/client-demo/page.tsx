import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import { getAllClientIds, getClientData } from "@/lib/client-demo/config";

export const metadata: Metadata = {
    title: "Client Demos | Nexus Dental",
    description: "Preview landing pages built for our clients, blending their brand with the Nexus Dental design system.",
    robots: { index: false, follow: false },
};

export default function ClientDemoHubPage() {
    const clients = getAllClientIds()
        .map((id) => getClientData(id))
        .filter((c) => c !== null);

    return (
        <section className="section-padding mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
                <span className="eyebrow">
                    <Sparkles className="h-3.5 w-3.5" />
                    Client showcase
                </span>
                <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] text-secondary sm:text-5xl">
                    Landing pages, reimagined for our clients.
                </h1>
                <p className="mt-5 text-base leading-7 text-text-secondary">
                    Each demo blends a client&apos;s existing brand, imagery, and services with the Nexus Dental design
                    system — a preview of what we can build together.
                </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                    <Link
                        key={client!.id}
                        href={`/client-demo/${client!.id}`}
                        className="group flex flex-col rounded-3xl border border-border-light bg-white p-7 no-underline transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[var(--shadow-elevated)]"
                    >
                        <h3 className="text-2xl text-secondary">{client!.name}</h3>
                        <p className="mt-3 flex-1 text-sm leading-7 text-text-secondary">{client!.tagline}</p>
                        <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary-dark">
                            View demo
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
