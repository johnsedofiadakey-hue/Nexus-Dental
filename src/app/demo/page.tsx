import type { Metadata } from "next";
import NexusDentalInteractiveDemo from "@/components/demo/NexusDentalInteractiveDemo";

export const metadata: Metadata = {
    title: "Interactive Product Demo | Nexus Dental",
    description:
        "Explore a read-only Nexus Dental product tour with sample clinic and patient data.",
};

const demoViews = ["today", "patient", "treatment", "billing", "portal"] as const;

type DemoView = (typeof demoViews)[number];

export default async function DemoPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string }>;
}) {
    const { view } = await searchParams;
    const initialView: DemoView = demoViews.includes(view as DemoView) ? (view as DemoView) : "today";

    return <NexusDentalInteractiveDemo initialView={initialView} />;
}
