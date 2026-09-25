"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ClinicSettings = {
    platformName: string;
    primaryColor: string;
    secondaryColor: string;
    featureFlags: Record<string, boolean>;
    hoursOfOperation?: Record<string, string>;
};

const defaults: ClinicSettings = {
    platformName: "Nexus Dental",
    primaryColor: "#0f9d8b",
    secondaryColor: "#10233f",
    featureFlags: {
        enableOnlineConsultation: true,
        enablePharmacy: true,
        enableTelehealth: true,
        enablePatientPortal: true,
    },
};

export default function SettingsPage() {
    const [form, setForm] = useState(defaults);
    const settingsQuery = useQuery<ClinicSettings>({
        queryKey: ["clinic-settings"],
        queryFn: async () => {
            const response = await fetch("/api/clinic/settings", { credentials: "include" });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Unable to load settings");
            return { ...defaults, ...payload.data, featureFlags: { ...defaults.featureFlags, ...(payload.data?.featureFlags || {}) } };
        },
    });

    useEffect(() => {
        if (settingsQuery.data) setForm(settingsQuery.data);
    }, [settingsQuery.data]);

    const save = useMutation({
        mutationFn: async () => {
            const response = await fetch("/api/clinic/settings", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Unable to save settings");
            return payload.data;
        },
        onSuccess: () => toast.success("Clinic settings saved"),
        onError: (error: Error) => toast.error(error.message),
    });

    const toggle = (key: string) => setForm((current) => ({ ...current, featureFlags: { ...current.featureFlags, [key]: !current.featureFlags[key] } }));

    return (
        <DashboardLayout title="Settings">
            <div className="mx-auto max-w-4xl space-y-6 pb-20">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Administration</p><h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Clinic settings</h2><p className="mt-2 text-sm text-slate-500">Control branding and the patient-facing modules available across the system.</p></div>
                {settingsQuery.isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : (
                    <>
                        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-teal-600" />Clinic identity</CardTitle></CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Clinic name</span><Input value={form.platformName || ""} onChange={(event) => setForm({ ...form, platformName: event.target.value })} /></label>
                                <label><span className="mb-1.5 block text-sm font-semibold">Primary colour</span><div className="flex gap-2"><Input type="color" value={form.primaryColor || defaults.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} className="w-16 px-2" /><Input value={form.primaryColor || ""} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} /></div></label>
                                <label><span className="mb-1.5 block text-sm font-semibold">Secondary colour</span><div className="flex gap-2"><Input type="color" value={form.secondaryColor || defaults.secondaryColor} onChange={(event) => setForm({ ...form, secondaryColor: event.target.value })} className="w-16 px-2" /><Input value={form.secondaryColor || ""} onChange={(event) => setForm({ ...form, secondaryColor: event.target.value })} /></div></label>
                            </CardContent>
                        </Card>
                        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardHeader><CardTitle className="text-lg">Patient modules</CardTitle></CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2">
                                {[
                                    ["enablePatientPortal", "Patient portal"],
                                    ["enableOnlineConsultation", "Online consultation"],
                                    ["enableTelehealth", "Telehealth rooms"],
                                    ["enablePharmacy", "Pharmacy workflow"],
                                ].map(([key, label]) => <button key={key} type="button" onClick={() => toggle(key)} className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold"><span>{label}</span><span className={`h-6 w-11 rounded-full p-1 transition-colors ${form.featureFlags[key] ? "bg-teal-600" : "bg-slate-200"}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${form.featureFlags[key] ? "translate-x-5" : ""}`} /></span></button>)}
                            </CardContent>
                        </Card>
                        <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending} className="min-h-11 bg-teal-600 hover:bg-teal-700">{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save settings</Button></div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
