import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClientData } from "@/lib/client-demo/config";
import ClientDemoHero from "@/components/client-demo/ClientDemoHero";
import ClientDemoServices from "@/components/client-demo/ClientDemoServices";
import ClientDemoTestimonials from "@/components/client-demo/ClientDemoTestimonials";
import ClientDemoContact from "@/components/client-demo/ClientDemoContact";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ clientId: string }>;
}): Promise<Metadata> {
    const { clientId } = await params;
    const client = getClientData(clientId);
    if (!client) return { title: "Client demo not found" };
    return {
        title: `${client.name} — Client Demo | Nexus Dental`,
        description: client.description,
        robots: { index: false, follow: false },
    };
}

export default async function ClientDemoPage({
    params,
}: {
    params: Promise<{ clientId: string }>;
}) {
    const { clientId } = await params;
    const client = getClientData(clientId);

    if (!client) notFound();

    return (
        <>
            <ClientDemoHero client={client} />
            <ClientDemoServices client={client} />
            <ClientDemoTestimonials client={client} />
            <ClientDemoContact client={client} />
        </>
    );
}
