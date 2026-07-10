import { notFound } from "next/navigation";
import { getClientData } from "@/lib/client-demo/config";
import ClientDemoNavbar from "@/components/client-demo/ClientDemoNavbar";
import ClientDemoFooter from "@/components/client-demo/ClientDemoFooter";

export default async function ClientDemoLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ clientId: string }>;
}) {
    const { clientId } = await params;
    const client = getClientData(clientId);

    if (!client) notFound();

    return (
        <div className="min-h-screen bg-white">
            <ClientDemoNavbar client={client} />
            <main>{children}</main>
            <ClientDemoFooter client={client} />
        </div>
    );
}
