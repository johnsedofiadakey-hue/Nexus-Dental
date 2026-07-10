import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClientData } from "@/lib/client-demo/config";
import ClientDemoAbout from "@/components/client-demo/ClientDemoAbout";
import ClientDemoInsurance from "@/components/client-demo/ClientDemoInsurance";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ clientId: string }>;
}): Promise<Metadata> {
    const { clientId } = await params;
    const client = getClientData(clientId);
    if (!client) return { title: "Client demo not found" };
    return { title: `About Us — ${client.name}`, robots: { index: false, follow: false } };
}

export default async function ClientDemoAboutPage({
    params,
}: {
    params: Promise<{ clientId: string }>;
}) {
    const { clientId } = await params;
    const client = getClientData(clientId);

    if (!client) notFound();

    return (
        <>
            <ClientDemoAbout client={client} />
            <ClientDemoInsurance client={client} />
        </>
    );
}
