import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClientData } from "@/lib/client-demo/config";
import ClientDemoServiceCatalog from "@/components/client-demo/ClientDemoServiceCatalog";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ clientId: string }>;
}): Promise<Metadata> {
    const { clientId } = await params;
    const client = getClientData(clientId);
    if (!client) return { title: "Client demo not found" };
    return { title: `Services — ${client.name}`, robots: { index: false, follow: false } };
}

export default async function ClientDemoServicesPage({
    params,
}: {
    params: Promise<{ clientId: string }>;
}) {
    const { clientId } = await params;
    const client = getClientData(clientId);

    if (!client) notFound();

    return (
        <div className="bg-white pt-14">
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
                    style={{ backgroundColor: `${client.colors.primary}18`, color: client.colors.primary }}
                >
                    Our services
                </span>
                <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                    Personalized, compassionate care for every stage of your smile.
                </h1>
            </div>
            <ClientDemoServiceCatalog client={client} />
        </div>
    );
}
