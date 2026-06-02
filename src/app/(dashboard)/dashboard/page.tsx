"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, TrendingUp, Clock, CheckCircle2, CreditCard, CalendarDays, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

interface ClinicStats {
    totalPatients: number;
    totalAppointments: number;
    completedAppointments: number;
    completionRate: number;
    totalStaff: number;
    revenue: number;
}

interface Appointment {
    id: string;
    dateTime: string;
    status: string;
    patient: { firstName: string; lastName: string };
    service: { name: string };
}

async function fetchClinicStats(): Promise<ClinicStats> {
    const res = await fetch("/api/analytics/clinic", { credentials: "include" });
    if (!res.ok) throw new Error("Failed");
    const json = await res.json();
    return json.data.clinic;
}

async function fetchTodayAppointments(): Promise<Appointment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const params = new URLSearchParams({
        dateFrom: today.toISOString(),
        dateTo: tomorrow.toISOString(),
        limit: "5",
    });
    const res = await fetch(`/api/appointments?${params}`, { credentials: "include" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.appointments ?? [];
}

function initials(first: string, last: string) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_BADGE: Record<string, string> = {
    SCHEDULED:   "bg-blue-50 text-blue-700",
    CONFIRMED:   "bg-teal-50 text-teal-700",
    IN_PROGRESS: "bg-amber-50 text-amber-700",
    COMPLETED:   "bg-emerald-50 text-emerald-700",
    CANCELLED:   "bg-red-50 text-red-700",
};

export default function ClinicDashboard() {
    const { data: user } = useCurrentUser();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["clinic-stats"],
        queryFn: fetchClinicStats,
        enabled: !!user,
    });

    const { data: todayAppts = [], isLoading: apptsLoading } = useQuery({
        queryKey: ["today-appointments"],
        queryFn: () => fetchTodayAppointments(),
        enabled: !!user,
    });

    const statCards = [
        {
            label: "Total Patients",
            value: statsLoading ? null : String(stats?.totalPatients ?? 0),
            sub: "Registered in clinic",
            icon: Users, color: "text-blue-600", bg: "bg-blue-50",
        },
        {
            label: "Total Appointments",
            value: statsLoading ? null : String(stats?.totalAppointments ?? 0),
            sub: `${stats?.completedAppointments ?? 0} completed`,
            icon: Calendar, color: "text-teal-600", bg: "bg-teal-50",
        },
        {
            label: "Completion Rate",
            value: statsLoading ? null : `${(stats?.completionRate ?? 0).toFixed(1)}%`,
            sub: "Appointments fulfilled",
            icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50",
        },
        {
            label: "Staff Members",
            value: statsLoading ? null : String(stats?.totalStaff ?? 0),
            sub: "Active team size",
            icon: Clock, color: "text-amber-600", bg: "bg-amber-50",
        },
    ];

    return (
        <DashboardLayout title="Clinic Overview">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
                    <p className="text-slate-500">Welcome back. Here is what&apos;s happening at your clinic today.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <CalendarDays className="w-4 h-4" /> Today
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700">Generate Report</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, i) => (
                    <Card key={i} className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                    {stat.value === null ? (
                                        <Skeleton className="h-8 w-20 mt-1" />
                                    ) : (
                                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                    )}
                                    <p className="text-xs text-slate-500 mt-2">{stat.sub}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg} shrink-0`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Today's Schedule */}
                <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Today&apos;s Schedule</CardTitle>
                            <CardDescription>Upcoming patient appointments</CardDescription>
                        </div>
                        <Button variant="ghost" className="text-teal-600 text-sm" asChild>
                            <a href="/appointments">View All</a>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {apptsLoading && (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                            </div>
                        )}
                        {!apptsLoading && todayAppts.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No appointments scheduled for today</p>
                            </div>
                        )}
                        {!apptsLoading && todayAppts.length > 0 && (
                            <div className="space-y-4">
                                {todayAppts.map((appt) => (
                                    <div key={appt.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 uppercase text-sm">
                                                {initials(appt.patient.firstName, appt.patient.lastName)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">
                                                    {appt.patient.firstName} {appt.patient.lastName}
                                                </p>
                                                <p className="text-xs text-slate-500">{appt.service.name} • {formatTime(appt.dateTime)}</p>
                                            </div>
                                        </div>
                                        <Badge className={`border-none font-bold ${STATUS_BADGE[appt.status] ?? "bg-slate-100 text-slate-600"}`}>
                                            {appt.status.replace("_", " ")}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[
                            { label: "New Appointment", href: "/appointments", icon: Calendar, color: "text-teal-600 bg-teal-50" },
                            { label: "Register Patient", href: "/patients", icon: Users, color: "text-blue-600 bg-blue-50" },
                            { label: "View Inventory", href: "/inventory", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
                            { label: "Finance Report", href: "/finance", icon: CreditCard, color: "text-purple-600 bg-purple-50" },
                        ].map((action) => (
                            <a
                                key={action.label}
                                href={action.href}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${action.color}`}>
                                    <action.icon className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-teal-600 transition-colors">
                                    {action.label}
                                </span>
                            </a>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
