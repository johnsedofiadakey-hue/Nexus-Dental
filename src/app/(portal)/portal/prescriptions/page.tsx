"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Pill,
    User,
    Calendar,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ClockIcon,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
        DISPENSED: {
            label: "Dispensed",
            className: "bg-emerald-50 text-emerald-700 border-emerald-200",
            Icon: CheckCircle2,
        },
        PENDING: {
            label: "Pending",
            className: "bg-amber-50 text-amber-700 border-amber-200",
            Icon: ClockIcon,
        },
        CANCELLED: {
            label: "Cancelled",
            className: "bg-red-50 text-red-700 border-red-200",
            Icon: XCircle,
        },
    };
    const { label, className, Icon } = map[status] ?? {
        label: status,
        className: "bg-slate-100 text-slate-600 border-slate-200",
        Icon: AlertCircle,
    };
    return (
        <Badge className={`border flex items-center gap-1 text-xs ${className}`}>
            <Icon className="w-3 h-3" />
            {label}
        </Badge>
    );
}

function PrescriptionCard({ rx }: { rx: any }) {
    const [expanded, setExpanded] = useState(false);
    const meds: any[] = rx.items ?? rx.medications ?? [];

    let dateStr = "—";
    try {
        if (rx.createdAt) dateStr = fmtDate(rx.createdAt);
    } catch {}

    const doctorName = rx.doctor
        ? `Dr. ${rx.doctor.firstName} ${rx.doctor.lastName}`
        : null;

    return (
        <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="px-6 py-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Pill className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-slate-900 text-base">
                            Prescription
                            {rx.id && (
                                <span className="text-slate-400 font-normal text-sm ml-2">
                                    #{rx.id.slice(-6).toUpperCase()}
                                </span>
                            )}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            {doctorName && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" /> {doctorName}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {dateStr}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={rx.status} />
                    {meds.length > 0 && (
                        <button
                            onClick={() => setExpanded((v) => !v)}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            aria-label={expanded ? "Collapse" : "Expand"}
                        >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Medication summary (collapsed) */}
            {!expanded && meds.length > 0 && (
                <div className="px-6 pb-5">
                    <p className="text-sm text-slate-500">
                        {meds.length} medication{meds.length !== 1 ? "s" : ""}:{" "}
                        <span className="text-slate-700 font-medium">
                            {meds
                                .slice(0, 3)
                                .map((m) => m.medication?.name ?? m.name ?? "Unknown")
                                .join(", ")}
                            {meds.length > 3 ? ` +${meds.length - 3} more` : ""}
                        </span>
                    </p>
                </div>
            )}

            {/* Expanded medications */}
            {expanded && meds.length > 0 && (
                <div className="border-t border-slate-100 px-6 py-5 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medications</p>
                    <div className="space-y-3">
                        {meds.map((item: any, i: number) => {
                            const name = item.medication?.name ?? item.name ?? "Medication";
                            const dosage = item.dosage ?? null;
                            const frequency = item.frequency ?? null;
                            const duration = item.duration ?? null;
                            const notes = item.notes ?? item.instructions ?? null;

                            return (
                                <div
                                    key={i}
                                    className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 ring-1 ring-purple-100"
                                >
                                    <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-900">{name}</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {dosage && (
                                                <span className="text-xs bg-white rounded-lg px-2 py-0.5 text-slate-600 border border-purple-100">
                                                    Dosage: {dosage}
                                                </span>
                                            )}
                                            {frequency && (
                                                <span className="text-xs bg-white rounded-lg px-2 py-0.5 text-slate-600 border border-purple-100">
                                                    {frequency}
                                                </span>
                                            )}
                                            {duration && (
                                                <span className="text-xs bg-white rounded-lg px-2 py-0.5 text-slate-600 border border-purple-100">
                                                    {duration}
                                                </span>
                                            )}
                                        </div>
                                        {notes && (
                                            <p className="text-xs text-slate-500 mt-1 italic">{notes}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {rx.instructions && (
                        <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800 border border-amber-100">
                            <p className="font-semibold text-xs uppercase tracking-widest text-amber-600 mb-1">Instructions</p>
                            {rx.instructions}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PrescriptionsPage() {
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
    const prescriptions: any[] = (history?.prescriptions ?? []).sort(
        (a: any, b: any) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

    const counts = {
        all: prescriptions.length,
        pending: prescriptions.filter((p) => p.status === "PENDING").length,
        dispensed: prescriptions.filter((p) => p.status === "DISPENSED").length,
        cancelled: prescriptions.filter((p) => p.status === "CANCELLED").length,
    };

    return (
        <DashboardLayout title="My Prescriptions">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">My Prescriptions</h2>
                    <p className="text-slate-500 mt-1">All prescriptions issued by your dental care team.</p>
                </div>

                {/* Summary chips */}
                {!isLoading && !userLoading && prescriptions.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-8">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                            <Pill className="w-4 h-4" /> {counts.all} Total
                        </div>
                        {counts.pending > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold border border-amber-100">
                                <ClockIcon className="w-4 h-4" /> {counts.pending} Pending
                            </div>
                        )}
                        {counts.dispensed > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-100">
                                <CheckCircle2 className="w-4 h-4" /> {counts.dispensed} Dispensed
                            </div>
                        )}
                        {counts.cancelled > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-700 text-sm font-semibold border border-red-100">
                                <XCircle className="w-4 h-4" /> {counts.cancelled} Cancelled
                            </div>
                        )}
                    </div>
                )}

                {/* List */}
                {isLoading || userLoading ? (
                    <div className="space-y-4">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                        ))}
                    </div>
                ) : isError ? (
                    <div className="text-center py-16">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-300" />
                        <p className="text-slate-500">Could not load prescriptions. Please try again.</p>
                    </div>
                ) : prescriptions.length === 0 ? (
                    <div className="text-center py-20">
                        <Pill className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-slate-400">No prescriptions yet</p>
                        <p className="text-slate-400 text-sm mt-1">
                            Prescriptions from your dental visits will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prescriptions.map((rx: any, i: number) => (
                            <PrescriptionCard key={rx.id ?? i} rx={rx} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
