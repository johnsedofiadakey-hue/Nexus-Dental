"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Calendar, Clock, CheckCircle2, Timer, MoreVertical, Plus,
    Search, TrendingUp, CreditCard, Package, ShieldAlert,
    Loader2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabFilter = "UPCOMING" | "IN_PROGRESS" | "COMPLETED";

interface Appointment {
    id: string;
    dateTime: string;
    status: string;
    patient: { id: string; firstName: string; lastName: string; phone: string };
    doctor: { firstName: string; lastName: string };
    service: { name: string; duration: number };
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function initials(first: string, last: string) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

const STATUS_MAP: Record<TabFilter, string> = {
    UPCOMING: "SCHEDULED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
};

async function fetchAppointments(tenantId: string, status: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const params = new URLSearchParams({
        tenantId,
        status,
        dateFrom: today.toISOString(),
        dateTo: tomorrow.toISOString(),
        limit: "20",
    });
    const res = await fetch(`/api/appointments?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch");
    const json = await res.json();
    return json.data?.appointments as Appointment[];
}

async function fetchClinicStats() {
    const res = await fetch("/api/analytics/clinic", { credentials: "include" });
    if (!res.ok) throw new Error("Failed");
    const json = await res.json();
    return json.data.clinic as { totalPatients: number; totalAppointments: number; completedAppointments: number; totalStaff: number };
}

async function patchStatus(id: string, status: string) {
    const res = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
}

export default function ClinicalDashboard() {
    const { data: user } = useCurrentUser();
    const [activeTab, setActiveTab] = useState<TabFilter>("UPCOMING");
    const queryClient = useQueryClient();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["clinic-stats"],
        queryFn: fetchClinicStats,
        enabled: !!user,
    });

    const { data: appointments = [], isLoading: apptsLoading, isError } = useQuery({
        queryKey: ["clinical-appointments", user?.tenantId, activeTab],
        queryFn: () => fetchAppointments(user!.tenantId!, STATUS_MAP[activeTab]),
        enabled: !!user?.tenantId,
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => patchStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clinical-appointments"] });
            queryClient.invalidateQueries({ queryKey: ["clinic-stats"] });
            toast.success("Session updated");
        },
        onError: () => toast.error("Failed to update session"),
    });

    const topStats = [
        { label: "Today's Appointments", value: statsLoading ? null : stats?.totalAppointments, sub: "All time", icon: Calendar, color: "text-teal-600", bg: "bg-teal-50" },
        { label: "Patients Waiting", value: statsLoading ? null : appointments.filter(a => a.status === "SCHEDULED").length, sub: "In queue", icon: Timer, color: "text-amber-600", bg: "bg-amber-50" },
        { label: "Completed Sessions", value: statsLoading ? null : stats?.completedAppointments, sub: "All time", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Total Staff", value: statsLoading ? null : stats?.totalStaff, sub: "Active members", icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50" },
    ];

    return (
        <DashboardLayout title="Clinical Operations">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {topStats.map((stat, i) => (
                    <Card key={i} className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                    {stat.value === null ? (
                                        <Skeleton className="h-8 w-16 mt-1" />
                                    ) : (
                                        <h3 className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                    )}
                                    <p className="text-xs text-slate-500 mt-2">{stat.sub}</p>
                                </div>
                                <div className={cn("p-3 rounded-xl shrink-0", stat.bg)}>
                                    <stat.icon className={cn("w-6 h-6", stat.color)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Appointment Queue */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle>Appointment Queue</CardTitle>
                                <CardDescription>Manage today&apos;s patient flow</CardDescription>
                            </div>
                            <Button size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700">
                                <Plus className="w-4 h-4" /> New Booking
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {/* Tabs */}
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
                                {(["UPCOMING", "IN_PROGRESS", "COMPLETED"] as TabFilter[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                                            activeTab === tab
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {tab === "IN_PROGRESS" ? "In Progress" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>

                            {apptsLoading && (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                                </div>
                            )}

                            {isError && (
                                <div className="flex items-center gap-2 text-red-600 text-sm p-4">
                                    <AlertCircle className="w-4 h-4" /> Failed to load appointments.
                                </div>
                            )}

                            {!apptsLoading && appointments.length === 0 && (
                                <div className="text-center py-10 text-slate-400">
                                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No {activeTab.toLowerCase().replace("_", " ")} appointments today</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {appointments.map((appt) => (
                                    <div key={appt.id} className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 hover:border-teal-100 transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center min-w-[60px] pr-4 border-r border-slate-100">
                                                <p className="text-lg font-bold text-slate-900">{formatTime(appt.dateTime).split(":")[0]}:{formatTime(appt.dateTime).split(":")[1]}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                    {new Date(appt.dateTime).getHours() >= 12 ? "PM" : "AM"}
                                                </p>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900">
                                                    {appt.patient.firstName} {appt.patient.lastName}
                                                </h4>
                                                <p className="text-sm text-slate-500">
                                                    {appt.service.name} • {appt.service.duration}min
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {activeTab === "UPCOMING" && (
                                                <Button
                                                    size="sm"
                                                    className="bg-teal-600 hover:bg-teal-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => statusMutation.mutate({ id: appt.id, status: "IN_PROGRESS" })}
                                                    disabled={statusMutation.isPending}
                                                >
                                                    Start Session
                                                </Button>
                                            )}
                                            {activeTab === "IN_PROGRESS" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => statusMutation.mutate({ id: appt.id, status: "COMPLETED" })}
                                                    disabled={statusMutation.isPending}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader>
                            <CardTitle className="text-lg">Clinical Alerts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                    <Package className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory</p>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">Check low stock items</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sessions</p>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">{stats?.completedAppointments ?? 0} sessions completed</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                                    <ShieldAlert className="w-5 h-5 text-teal-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</p>
                                    <p className="text-sm font-medium text-slate-900 mt-0.5">Monitor emergency queue</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full text-teal-600 hover:bg-teal-50 mt-2" asChild>
                                <a href="/appointments">View All Appointments</a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
