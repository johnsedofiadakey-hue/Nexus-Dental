import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Nexus Dental",
        short_name: "Nexus Dental",
        description: "Book dental care, access your records, and stay connected with your care team.",
        start_url: "/",
        display: "standalone",
        background_color: "#f7fbfa",
        theme_color: "#0f9d8b",
        orientation: "portrait-primary",
    };
}
