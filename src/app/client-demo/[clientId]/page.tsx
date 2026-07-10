import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClientData } from "@/lib/client-demo/config";
import ClientDemoHero from "@/components/client-demo/ClientDemoHero";
import ClientDemoInsurance from "@/components/client-demo/ClientDemoInsurance";
import ClientDemoStats from "@/components/client-demo/ClientDemoStats";
import ClientDemoServices from "@/components/client-demo/ClientDemoServices";
import ClientDemoComfort from "@/components/client-demo/ClientDemoComfort";
import ClientDemoAbout from "@/components/client-demo/ClientDemoAbout";
import ClientDemoTestimonials from "@/components/client-demo/ClientDemoTestimonials";
import ClientDemoFAQ from "@/components/client-demo/ClientDemoFAQ";
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
        title: `${client.name} — Client Demo`,
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
            <ClientDemoStats client={client} />
            <ClientDemoInsurance client={client} />
            <ClientDemoServices client={client} />
            <ClientDemoComfort client={client} />
            <ClientDemoAbout client={client} />
            <ClientDemoTestimonials client={client} />
            <ClientDemoFAQ client={client} />
            <ClientDemoContact client={client} />
        </>
    );
}
