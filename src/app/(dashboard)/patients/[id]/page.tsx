"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    Calendar,
    ClipboardList,
    CreditCard,
    FileImage,
    FlaskConical,
    HeartPulse,
    Loader2,
    MessageSquare,
    Pill,
    Receipt,
    Stethoscope,
    UserRound,
    Upload,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type RecordItem = Record<string, unknown> & { id: string };
type PatientRecord = {
    patient: {
        id: string;
        firstName: string;
        lastName: string;
        phone: string;
        email?: string | null;
        dateOfBirth?: string | null;
        gender?: string | null;
        bloodType?: string | null;
        allergies?: string | null;
        medicalNotes?: string | null;
        insuranceProvider?: string | null;
        insurancePolicyNo?: string | null;
        lastVisitAt?: string | null;
    };
    appointments: RecordItem[];
    prescriptions: RecordItem[];
    invoices: RecordItem[];
    treatmentPlans: RecordItem[];
    toothRecords: RecordItem[];
    files: RecordItem[];
    labOrders: RecordItem[];
    consents: RecordItem[];
    supportTickets: RecordItem[];
    timeline: Array<{
        id: string;
        type: string;
        date: string;
        title: string;
        description?: string;
        status?: string;
    }>;
};

const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "treatment", label: "Treatment", icon: ClipboardList },
    { id: "chart", label: "Chart & scans", icon: FileImage },
    { id: "visits", label: "Visits", icon: Calendar },
    { id: "medications", label: "Medications", icon: Pill },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "labs", label: "Labs & consent", icon: FlaskConical },
    { id: "messages", label: "Messages", icon: MessageSquare },
] as const;

type TabId = typeof tabs[number]["id"];

function dateLabel(value: unknown) {
    if (!value) return "—";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(status: unknown) {
    const value = String(status || "UNKNOWN");
    const positive = ["COMPLETED", "PAID", "FILLED", "SIGNED", "READY", "FITTED"].includes(value);
    return (
        <Badge className={positive ? "border-0 bg-emerald-50 text-emerald-700" : "border-0 bg-slate-100 text-slate-600"}>
            {value.replaceAll("_", " ")}
        </Badge>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
            No {label.toLowerCase()} recorded for this patient yet.
        </div>
    );
}

export default function PatientWorkspacePage() {
    const params = useParams<{ id: string }>();
    const patientId = params.id;
    const [activeTab, setActiveTab] = useState<TabId>("overview");
    const [uploadCategory, setUploadCategory] = useState("xray");
    const [uploading, setUploading] = useState(false);

    const { data, isLoading, isError, refetch } = useQuery<PatientRecord>({
        queryKey: ["patient-workspace", patientId],
        queryFn: async () => {
            const response = await fetch(`/api/patients/${patientId}/history`, { credentials: "include" });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Unable to load patient record");
            return payload.data as PatientRecord;
        },
        enabled: Boolean(patientId),
    });

    if (isLoading) {
        return (
            <DashboardLayout title="Patient record">
                <div className="flex min-h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </div>
            </DashboardLayout>
        );
    }

    if (isError || !data) {
        return (
            <DashboardLayout title="Patient record">
                <Card className="mx-auto max-w-lg border-red-100 bg-red-50">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
                        <p className="font-semibold text-red-900">This patient record could not be loaded.</p>
                        <Button className="mt-5" variant="outline" onClick={() => refetch()}>Try again</Button>
                    </CardContent>
                </Card>
            </DashboardLayout>
        );
    }

    const { patient } = data;
    const age = patient.dateOfBirth
        ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear())
        : null;

    async function uploadPatientFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) return toast.error("Files must be 15 MB or smaller");
        setUploading(true);
        try {
            const urlResponse = await fetch("/api/upload/url", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream", folder: `patients/${patient.id}` }),
            });
            const urlPayload = await urlResponse.json();
            if (!urlResponse.ok) throw new Error(urlPayload.error || "Unable to prepare upload");

            const uploadResponse = await fetch(urlPayload.data.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type || "application/octet-stream" },
                body: file,
            });
            if (!uploadResponse.ok) throw new Error("File upload failed");

            const recordResponse = await fetch("/api/patient-files", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: patient.id,
                    filename: file.name,
                    fileType: file.type || "application/octet-stream",
                    fileSize: file.size,
                    storageKey: urlPayload.data.key,
                    category: uploadCategory,
                }),
            });
            const recordPayload = await recordResponse.json();
            if (!recordResponse.ok) throw new Error(recordPayload.error || "Unable to save file record");
            await refetch();
            toast.success("Patient file uploaded");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload file");
        } finally {
            setUploading(false);
        }
    }

    return (
        <DashboardLayout title="Patient record">
            <div className="space-y-6 pb-20 lg:pb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="outline" size="icon" className="shrink-0 rounded-xl">
                            <Link href="/patients" aria-label="Back to patients"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Patient 360</p>
                            <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">{patient.firstName} {patient.lastName}</h2>
                            <p className="text-sm text-slate-500">{patient.phone}{patient.email ? ` · ${patient.email}` : ""}</p>
                        </div>
                    </div>
                    <Button asChild className="min-h-11 bg-teal-600 hover:bg-teal-700">
                        <Link href={`/booking?patientId=${patient.id}`}><Calendar className="mr-2 h-4 w-4" />Book appointment</Link>
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: "Appointments", value: data.appointments.length, icon: Calendar },
                        { label: "Active plans", value: data.treatmentPlans.filter((plan) => plan.status === "ACTIVE").length, icon: ClipboardList },
                        { label: "Scans & files", value: data.files.length, icon: FileImage },
                        { label: "Open balance", value: data.invoices.filter((invoice) => invoice.status !== "PAID").length, icon: Receipt },
                    ].map((stat) => (
                        <Card key={stat.label} className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardContent className="p-4 sm:p-5">
                                <stat.icon className="mb-3 h-5 w-5 text-teal-600" />
                                <p className="text-2xl font-bold text-slate-950">{stat.value}</p>
                                <p className="text-xs text-slate-500">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {(patient.allergies || patient.medicalNotes) && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <div className="mb-2 flex items-center gap-2 font-bold"><HeartPulse className="h-4 w-4" />Clinical alerts</div>
                        {patient.allergies && <p><strong>Allergies:</strong> {patient.allergies}</p>}
                        {patient.medicalNotes && <p className="mt-1"><strong>Notes:</strong> {patient.medicalNotes}</p>}
                    </div>
                )}

                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                    <div className="flex min-w-max gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${activeTab === tab.id ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                            >
                                <tab.icon className="h-4 w-4" />{tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === "overview" && (
                    <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserRound className="h-5 w-5 text-teal-600" />Patient details</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4 text-sm">
                                <div><p className="text-slate-400">Age</p><p className="font-semibold">{age ?? "—"}</p></div>
                                <div><p className="text-slate-400">Gender</p><p className="font-semibold">{patient.gender || "—"}</p></div>
                                <div><p className="text-slate-400">Blood type</p><p className="font-semibold">{patient.bloodType || "—"}</p></div>
                                <div><p className="text-slate-400">Last visit</p><p className="font-semibold">{dateLabel(patient.lastVisitAt)}</p></div>
                                <div className="col-span-2"><p className="text-slate-400">Insurance</p><p className="font-semibold">{patient.insuranceProvider || "Not recorded"} {patient.insurancePolicyNo ? `· ${patient.insurancePolicyNo}` : ""}</p></div>
                            </CardContent>
                        </Card>
                        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardHeader><CardTitle className="text-lg">Recent activity</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {data.timeline.slice(0, 8).map((event) => (
                                    <div key={`${event.type}-${event.id}`} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500 ring-4 ring-teal-50" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <p className="font-semibold text-slate-900">{event.title}</p>
                                                <span className="text-xs text-slate-400">{dateLabel(event.date)}</span>
                                            </div>
                                            {event.description && <p className="mt-1 text-sm text-slate-500">{event.description}</p>}
                                        </div>
                                    </div>
                                ))}
                                {data.timeline.length === 0 && <EmptyState label="Activity" />}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "treatment" && (
                    <div className="space-y-4">
                        {data.treatmentPlans.map((plan) => {
                            const steps = Array.isArray(plan.steps) ? plan.steps as RecordItem[] : [];
                            return (
                                <Card key={plan.id} className="border-0 shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-5 sm:p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div><h3 className="font-bold text-slate-950">{String(plan.title)}</h3><p className="mt-1 text-sm text-slate-500">{String(plan.description || "No description")}</p></div>
                                            {statusBadge(plan.status)}
                                        </div>
                                        <div className="mt-5 space-y-2">
                                            {steps.map((step) => <div key={step.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{String(step.stepNumber)}. {String(step.title)}</span>{statusBadge(step.status)}</div>)}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {data.treatmentPlans.length === 0 && <EmptyState label="Treatment plans" />}
                    </div>
                )}

                {activeTab === "chart" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">Dental chart</CardTitle><Button asChild size="sm" variant="outline"><Link href={`/dental-chart?patientId=${patient.id}`}>Open chart</Link></Button></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{data.toothRecords.length}</p><p className="text-sm text-slate-500">teeth with recorded findings or treatment</p></CardContent>
                        </Card>
                        <Card className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-lg">Scans and files</CardTitle><div className="flex gap-2"><select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"><option value="xray">X-ray</option><option value="photo">Photo</option><option value="document">Document</option><option value="lab_result">Lab result</option></select><label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-3 text-xs font-semibold text-white"><Upload className="mr-1.5 h-4 w-4" />{uploading ? "Uploading..." : "Upload"}<input type="file" className="sr-only" disabled={uploading} accept="image/*,.pdf" onChange={uploadPatientFile} /></label></div></CardHeader>
                            <CardContent className="space-y-3">
                                {data.files.map((file) => <a key={file.id} href={`/api/patient-files/${file.id}?redirect=true`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-teal-50"><FileImage className="h-5 w-5 text-teal-600" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{String(file.filename)}</p><p className="text-xs text-slate-500">{String(file.category)} · {dateLabel(file.createdAt)}</p></div></a>)}
                                {data.files.length === 0 && <EmptyState label="Scans or files" />}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "visits" && <RecordList records={data.appointments} titleKey="services" dateKey="dateTime" empty="Appointments" />}
                {activeTab === "medications" && <RecordList records={data.prescriptions} titleKey="medications" dateKey="issuedAt" empty="Prescriptions" />}
                {activeTab === "billing" && <RecordList records={data.invoices} titleKey="totalAmount" dateKey="createdAt" empty="Invoices" money />}
                {activeTab === "labs" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                        <RecordList records={data.labOrders} titleKey="restoration" dateKey="createdAt" empty="Lab orders" />
                        <RecordList records={data.consents} titleKey="template" dateKey="signedAt" empty="Consent forms" />
                    </div>
                )}
                {activeTab === "messages" && <RecordList records={data.supportTickets} titleKey="subject" dateKey="updatedAt" empty="Messages" />}
            </div>
        </DashboardLayout>
    );
}

function RecordList({ records, titleKey, dateKey, empty, money = false }: { records: RecordItem[]; titleKey: string; dateKey: string; empty: string; money?: boolean }) {
    if (records.length === 0) return <EmptyState label={empty} />;
    return (
        <div className="space-y-3">
            {records.map((record) => {
                const rawTitle = record[titleKey];
                const title = money
                    ? `GHS ${Number(rawTitle || 0).toFixed(2)}`
                    : Array.isArray(rawTitle)
                        ? rawTitle.map((item) => typeof item === "object" && item && "name" in item ? String(item.name) : "Item").join(", ")
                        : typeof rawTitle === "object" && rawTitle
                            ? "Recorded document"
                            : String(rawTitle || empty.slice(0, -1));
                return (
                    <Card key={record.id} className="border-0 shadow-sm ring-1 ring-slate-100">
                        <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Stethoscope className="h-5 w-5" /></span>
                            <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-950">{title}</p><p className="text-xs text-slate-500">{dateLabel(record[dateKey])}</p></div>
                            {statusBadge(record.status)}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
