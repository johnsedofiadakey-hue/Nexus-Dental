"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Calendar,
    Pill,
    Receipt,
    Clock,
    User,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

type TimelineItem =
    | { kind: "appointment"; date: string; data: any }
    | { kind: "prescription"; date: string; data: any }
    | { kind: "invoice"; date: string; data: any };

function AppointmentCard({ data }: { data: any }) {
    const statusColors: Record<string, string> = {
        CONFIRMED: "bg-teal-50 text-teal-700 border-teal-200",
        COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
        PENDING: "bg-amber-50 text-amber-700 border-amber-200",
        CANCELLED: "bg-red-50 text-red-700 border-red-200",
    };
    const color = statusColors[data.status] ?? "bg-slate-100 text-slate-600 border-slate-200";

    return (
        <div className="bg-white rounded-2xl ring-1 ring-teal-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900">
                            {data.services?.[0]?.name ?? "Appointment"}
                        </p>
                        {data.doctor && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" />
                                Dr. {data.doctor.firstName} {data.doctor.lastName}
                            </p>
                        )}
                    </div>
                </div>
                <Badge className={`border text-xs ${color}`}>{data.status}</Badge>
            </div>
            {data.notes && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-2">{data.notes}</p>
            )}
        </div>
    );
}

function PrescriptionCard({ data }: { data: any }) {
    const statusColors: Record<string, string> = {
        DISPENSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
        PENDING: "bg-amber-50 text-amber-700 border-amber-200",
        CANCELLED: "bg-red-50 text-red-700 border-red-200",
    };
    const color = statusColors[data.status] ?? "bg-slate-100 text-slate-600 border-slate-200";
    const meds: any[] = data.items ?? data.medications ?? [];

    return (
        <div className="bg-white rounded-2xl ring-1 ring-blue-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Pill className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900">Prescription</p>
                        {data.doctor && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" />
                                Dr. {data.doctor.firstName} {data.doctor.lastName}
                            </p>
                        )}
                    </div>
                </div>
                <Badge className={`border text-xs ${color}`}>{data.status}</Badge>
            </div>
            {meds.length > 0 && (
                <ul className="space-y-1">
                    {meds.map((item: any, i: number) => (
                        <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            {item.medication?.name ?? item.name ?? "Medication"}
                            {(item.dosage || item.frequency) && (
                                <span className="text-slate-400 text-xs">
                                    — {[item.dosage, item.frequency].filter(Boolean).join(", ")}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {data.instructions && (
                <p className="text-xs text-slate-500 italic bg-blue-50 rounded-xl px-4 py-2">{data.instructions}</p>
            )}
        </div>
    );
}

function InvoiceCard({ data }: { data: any }) {
    const statusColors: Record<string, string> = {
        PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
        PENDING: "bg-amber-50 text-amber-700 border-amber-200",
        OVERDUE: "bg-red-50 text-red-700 border-red-200",
        CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
    };
    const color = statusColors[data.status] ?? "bg-slate-100 text-slate-600 border-slate-200";

    return (
        <div className="bg-white rounded-2xl ring-1 ring-emerald-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className="font-bold text-slate-900">Invoice #{data.invoiceNumber ?? data.id?.slice(-6)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {data.amount != null ? `GHS ${Number(data.amount).toFixed(2)}` : "Amount pending"}
                    </p>
                </div>
            </div>
            <Badge className={`border text-xs ${color}`}>{data.status}</Badge>
        </div>
    );
}

export default function RecordsPage() {
    const { data: user, isLoading: userLoading } = useCurrentUser();

    const { data: historyData, isLoading, isError } = useQuery({
        queryKey: ["patient-history", user?.id],
        queryFn: async () => {
            const res = await fetch(`/api/patients/${user!.id}/history`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json();
        },
        enabled: !!user?.id,
    });

    const history = historyData?.data ?? historyData ?? {};
    const appointments: any[] = history?.appointments ?? [];
    const prescriptions: any[] = history?.prescriptions ?? [];
    const invoices: any[] = history?.invoices ?? [];

    // Build unified timeline
    const timeline: TimelineItem[] = [
        ...appointments.map((a) => ({
            kind: "appointment" as const,
            date: a.dateTime ?? a.date ?? a.createdAt,
            data: a,
        })),
        ...prescriptions.map((p) => ({
            kind: "prescription" as const,
            date: p.createdAt ?? p.date,
            data: p,
        })),
        ...invoices.map((inv) => ({
            kind: "invoice" as const,
            date: inv.createdAt ?? inv.date,
            data: inv,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const dotColor = {
        appointment: "bg-teal-500 ring-teal-100",
        prescription: "bg-blue-500 ring-blue-100",
        invoice: "bg-emerald-500 ring-emerald-100",
    };

    return (
        <DashboardLayout title="Medical Records">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Medical History</h2>
                    <p className="text-slate-500 mt-1">Your complete health timeline — appointments, prescriptions, and invoices.</p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mb-8">
                    {[
                        { label: "Appointment", color: "bg-teal-500" },
                        { label: "Prescription", color: "bg-blue-500" },
                        { label: "Invoice", color: "bg-emerald-500" },
                    ].map(({ label, color }) => (
                        <div key={label} className="flex items-center gap-2 text-sm text-slate-600">
                            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                            {label}
                        </div>
                    ))}
                </div>

                {/* Timeline */}
                {isLoading || userLoading ? (
                    <div className="space-y-6">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <Skeleton className="w-4 h-4 rounded-full mt-1" />
                                    <div className="w-0.5 flex-1 bg-slate-100 mt-2" />
                                </div>
                                <div className="flex-1 pb-8">
                                    <Skeleton className="h-4 w-24 mb-3" />
                                    <Skeleton className="h-20 w-full rounded-2xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <div className="text-center py-16 text-slate-500">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-300" />
                        <p>Could not load your records. Please try again.</p>
                    </div>
                ) : timeline.length === 0 ? (
                    <div className="text-center py-20">
                        <Calendar className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-slate-400">No records yet</p>
                        <p className="text-slate-400 text-sm mt-1">Your health timeline will appear here after your first visit.</p>
                    </div>
                ) : (
                    <div className="relative">
                        {timeline.map((item, idx) => {
                            const isLast = idx === timeline.length - 1;
                            let dateStr = "—";
                            try {
                                dateStr = item.date ? fmtDate(item.date) : "—";
                            } catch {}

                            return (
                                <div key={`${item.kind}-${item.data.id}-${idx}`} className="flex gap-4">
                                    {/* Timeline dot + line */}
                                    <div className="flex flex-col items-center">
                                        <span
                                            className={`w-4 h-4 rounded-full ring-4 flex-shrink-0 mt-1 ${dotColor[item.kind]}`}
                                        />
                                        {!isLast && (
                                            <div className="w-0.5 flex-1 bg-slate-100 mt-2" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-1 ${!isLast ? "pb-8" : "pb-2"}`}>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" /> {dateStr}
                                        </p>
                                        {item.kind === "appointment" && <AppointmentCard data={item.data} />}
                                        {item.kind === "prescription" && <PrescriptionCard data={item.data} />}
                                        {item.kind === "invoice" && <InvoiceCard data={item.data} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
