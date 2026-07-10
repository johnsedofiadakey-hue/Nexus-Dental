import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClientData } from "@/lib/client-demo/config";
import ClientDemoContactPage from "@/components/client-demo/ClientDemoContactPage";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ clientId: string }>;
}): Promise<Metadata> {
    const { clientId } = await params;
    const client = getClientData(clientId);
    if (!client) return { title: "Client demo not found" };
    return { title: `Contact Us — ${client.name}`, robots: { index: false, follow: false } };
}

export default async function ClientDemoContactRoutePage({
    params,
}: {
    params: Promise<{ clientId: string }>;
}) {
    const { clientId } = await params;
    const client = getClientData(clientId);

    if (!client) notFound();

    return <ClientDemoContactPage client={client} />;
}
