"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Calendar, Plus, Search, Clock, ChevronLeft, ChevronRight, Loader2,
    CheckCircle2, XCircle, AlertCircle, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface Appointment {
    id: string;
    dateTime: string;
    status: AppointmentStatus;
    notes?: string;
    patient: { id: string; firstName: string; lastName: string; phone: string };
    doctor: { id: string; firstName: string; lastName: string; specialty?: string };
    service: { id: string; name: string; price: number; duration: number };
}

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; className: string }> = {
    SCHEDULED:   { label: "Scheduled",   className: "bg-blue-50 text-blue-700" },
    CONFIRMED:   { label: "Confirmed",   className: "bg-teal-50 text-teal-700" },
    IN_PROGRESS: { label: "In Progress", className: "bg-amber-50 text-amber-700" },
    COMPLETED:   { label: "Completed",   className: "bg-emerald-50 text-emerald-700" },
    CANCELLED:   { label: "Cancelled",   className: "bg-red-50 text-red-700" },
    NO_SHOW:     { label: "No Show",     className: "bg-slate-100 text-slate-500" },
};

function initials(first: string, last: string) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function fetchAppointments(status: string, search: string, page: number) {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`/api/appointments?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch appointments");
    const json = await res.json();
    return json.data as { appointments: Appointment[]; pagination: { total: number; totalPages: number; page: number } };
}

async function updateStatus(appointmentId: string, status: AppointmentStatus) {
    const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to update status");
    return res.json();
}

export default function AppointmentsPage() {
    const { data: user } = useCurrentUser();
    const [status, setStatus] = useState<string>("ALL");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const queryClient = useQueryClient();

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["appointments", status, page],
        queryFn: () => fetchAppointments(status, search, page),
        enabled: !!user,
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, newStatus }: { id: string; newStatus: AppointmentStatus }) =>
            updateStatus(id, newStatus),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            toast.success("Appointment status updated");
        },
        onError: () => toast.error("Failed to update status"),
    });

    const appointments = data?.appointments ?? [];
    const pagination = data?.pagination;

    const tabs: { id: string; label: string }[] = [
        { id: "ALL", label: "All" },
        { id: "SCHEDULED", label: "Scheduled" },
        { id: "CONFIRMED", label: "Confirmed" },
        { id: "IN_PROGRESS", label: "In Progress" },
        { id: "COMPLETED", label: "Completed" },
        { id: "CANCELLED", label: "Cancelled" },
    ];

    return (
        <DashboardLayout title="Appointments">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Schedule Management</h2>
                    <p className="text-slate-500">Manage bookings, check-ins, and doctor availability.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                        <Plus className="w-4 h-4" /> New Booking
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6 flex-wrap">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => { setStatus(t.id); setPage(1); }}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            status === t.id
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search patient name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 rounded-xl bg-white border-none shadow-sm"
                />
            </div>

            {/* Content */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
            )}

            {isError && (
                <Card className="border-none shadow-sm ring-1 ring-red-100 bg-red-50">
                    <CardContent className="p-6 flex items-center gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>Failed to load appointments. <button className="underline" onClick={() => refetch()}>Retry</button></p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && appointments.length === 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-12 text-center text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">No appointments found</p>
                        <p className="text-sm mt-1">Try changing the filter or book a new appointment.</p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && appointments.length > 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Patient</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Doctor</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Service</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {appointments.map((appt) => {
                                    const cfg = STATUS_CONFIG[appt.status];
                                    return (
                                        <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 text-xs">
                                                        {initials(appt.patient.firstName, appt.patient.lastName)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{appt.patient.firstName} {appt.patient.lastName}</p>
                                                        <p className="text-xs text-slate-400">{appt.patient.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-800">Dr. {appt.doctor.lastName}</p>
                                                {appt.doctor.specialty && (
                                                    <p className="text-xs text-slate-400">{appt.doctor.specialty}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-800">{appt.service.name}</p>
                                                <p className="text-xs text-slate-400">{appt.service.duration} min</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-semibold text-slate-900">{formatTime(appt.dateTime)}</p>
                                                <p className="text-xs text-slate-400">{formatDate(appt.dateTime)}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge className={`${cfg.className} border-none font-bold`}>{cfg.label}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {appt.status === "SCHEDULED" && (
                                                        <Button
                                                            size="sm" variant="outline"
                                                            className="text-teal-600 border-teal-200 hover:bg-teal-50"
                                                            onClick={() => statusMutation.mutate({ id: appt.id, newStatus: "CONFIRMED" })}
                                                            disabled={statusMutation.isPending}
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm
                                                        </Button>
                                                    )}
                                                    {appt.status === "CONFIRMED" && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-teal-600 hover:bg-teal-700"
                                                            onClick={() => statusMutation.mutate({ id: appt.id, newStatus: "IN_PROGRESS" })}
                                                            disabled={statusMutation.isPending}
                                                        >
                                                            Start Session
                                                        </Button>
                                                    )}
                                                    {(appt.status === "SCHEDULED" || appt.status === "CONFIRMED") && (
                                                        <Button
                                                            size="sm" variant="ghost"
                                                            className="text-red-500 hover:bg-red-50"
                                                            onClick={() => statusMutation.mutate({ id: appt.id, newStatus: "CANCELLED" })}
                                                            disabled={statusMutation.isPending}
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                            <p className="text-sm text-slate-500">
                                Showing {((pagination.page - 1) * 20) + 1}–{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === pagination.totalPages}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </DashboardLayout>
    );
}
