"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialForm = {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    bloodType: "",
    allergies: "",
    medicalNotes: "",
    insuranceProvider: "",
    insurancePolicyNo: "",
};

export default function NewPatientPage() {
    const router = useRouter();
    const [form, setForm] = useState(initialForm);
    const [saving, setSaving] = useState(false);

    const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((current) => ({ ...current, [field]: event.target.value }));
    };

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            const response = await fetch("/api/patients", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Unable to create patient");
            toast.success("Patient record created");
            router.push(`/patients/${payload.data.id}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to create patient");
        } finally {
            setSaving(false);
        }
    }

    return (
        <DashboardLayout title="New patient">
            <div className="mx-auto max-w-4xl pb-20">
                <div className="mb-6 flex items-center gap-3">
                    <Button asChild variant="outline" size="icon" className="rounded-xl"><Link href="/patients"><ArrowLeft className="h-4 w-4" /></Link></Button>
                    <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Patient registry</p><h2 className="text-2xl font-bold text-slate-950">Create patient record</h2></div>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                        <CardHeader><CardTitle className="text-lg">Identity and contact</CardTitle></CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="First name" required><Input value={form.firstName} onChange={update("firstName")} required /></Field>
                            <Field label="Last name" required><Input value={form.lastName} onChange={update("lastName")} required /></Field>
                            <Field label="Phone" required><Input type="tel" value={form.phone} onChange={update("phone")} required /></Field>
                            <Field label="Email"><Input type="email" value={form.email} onChange={update("email")} /></Field>
                            <Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} /></Field>
                            <Field label="Gender"><select value={form.gender} onChange={update("gender")} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option></select></Field>
                            <Field label="Address" wide><Input value={form.address} onChange={update("address")} /></Field>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                        <CardHeader><CardTitle className="text-lg">Clinical and insurance information</CardTitle></CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Blood type"><Input value={form.bloodType} onChange={update("bloodType")} /></Field>
                            <Field label="Allergies"><Input value={form.allergies} onChange={update("allergies")} /></Field>
                            <Field label="Insurance provider"><Input value={form.insuranceProvider} onChange={update("insuranceProvider")} /></Field>
                            <Field label="Policy number"><Input value={form.insurancePolicyNo} onChange={update("insurancePolicyNo")} /></Field>
                            <Field label="Medical notes" wide><textarea value={form.medicalNotes} onChange={update("medicalNotes")} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" /></Field>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button asChild type="button" variant="outline"><Link href="/patients">Cancel</Link></Button>
                        <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Create patient
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}

function Field({ label, required = false, wide = false, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
    return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required ? " *" : ""}</span>{children}</label>;
}
