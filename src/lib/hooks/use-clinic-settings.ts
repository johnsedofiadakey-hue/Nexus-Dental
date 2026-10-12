"use client";

import { useQuery } from "@tanstack/react-query";

export type ClinicSettings = {
    platformName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    featureFlags?: Record<string, boolean> | null;
};

const fallbackSettings: Required<Omit<ClinicSettings, "logoUrl">> & Pick<ClinicSettings, "logoUrl"> = {
    platformName: process.env.NEXT_PUBLIC_CLINIC_NAME || "Nexus Dental",
    logoUrl: null,
    primaryColor: "#0d9488",
    secondaryColor: "#10233f",
    featureFlags: {
        enableOnlineConsultation: true,
        enablePharmacy: true,
        enableTelehealth: true,
        enablePatientPortal: true,
    },
};

async function fetchClinicSettings(): Promise<ClinicSettings> {
    const response = await fetch("/api/clinic/settings", { credentials: "include" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Unable to load clinic settings");

    return {
        ...fallbackSettings,
        ...payload.data,
        featureFlags: {
            ...fallbackSettings.featureFlags,
            ...(payload.data?.featureFlags || {}),
        },
    };
}

export function useClinicSettings(enabled = true) {
    return useQuery<ClinicSettings, Error>({
        queryKey: ["clinic-settings"],
        queryFn: fetchClinicSettings,
        enabled,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
}

export { fallbackSettings };

