"use client";

import { useQuery } from "@tanstack/react-query";
import {
    TrendingUp, Users, Calendar, DollarSign, CheckCircle2,
    BarChart2, PieChart, Loader2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

interface MonthData { month: string; appointments: number; revenue: number }
interface ServiceRow { name: string; category: string; _count: { appointments: number } }
interface StatusRow  { status: string; _count: { id: number } }
interface TopPatient { firstName: string; lastName: string; _count: { appointments: number } }

interface Overview {
    monthlyData: MonthData[];
    serviceBreakdown: ServiceRow[];
    statusBreakdown: StatusRow[];
    topPatients: TopPatient[];
}

const CATEGORY_COLORS: Record<string, string> = {
    GENERAL: "bg-teal-500",
    COSMETIC: "bg-purple-500",
    ORTHODONTICS: "bg-blue-500",
    RESTORATIVE: "bg-amber-500",
    PEDIATRIC: "bg-pink-500",
    EMERGENCY: "bg-red-500",
    CONSULTATION: "bg-emerald-500",
};

const STATUS_COLORS: Record<string, string> = {
    COMPLETED: "bg-emerald-500",
    SCHEDULED: "bg-blue-400",
    CONFIRMED: "bg-teal-400",
    IN_PROGRESS: "bg-amber-400",
    CANCELLED: "bg-red-400",
    NO_SHOW: "bg-slate-300",
};

function BarChart({ data }: { data: MonthData[] }) {
    const maxAppts = Math.max(...data.map(d => d.appointments), 1);
    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    return (
        <div className="flex items-end gap-3 h-40 pt-2">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center gap-0.5 justify-end h-32">
                        <div
                            className="w-full rounded-t-lg bg-teal-500 transition-all"
                            style={{ height: `${(d.appointments / maxAppts) * 100}%`, minHeight: d.appointments > 0 ? 4 : 0 }}
                            title={`${d.appointments} appts`}
                        />
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{d.month}</p>
                    <p className="text-[10px] text-teal-600 font-bold">{d.appointments}</p>
                </div>
            ))}
        </div>
    );
}

function RevenueChart({ data }: { data: MonthData[] }) {
    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    return (
        <div className="flex items-end gap-3 h-40 pt-2">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center gap-0.5 justify-end h-32">
                        <div
                            className="w-full rounded-t-lg bg-emerald-500 transition-all"
                            style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                            title={`GH₵ ${d.revenue}`}
                        />
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{d.month}</p>
                    <p className="text-[10px] text-emerald-600 font-bold">
                        {d.revenue > 0 ? `GH₵${(d.revenue / 1000).toFixed(1)}k` : "0"}
                    </p>
                </div>
            ))}
        </div>
    );
}

async function fetchOverview(): Promise<Overview> {
    const res = await fetch("/api/analytics/overview", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch analytics");
    return (await res.json()).data as Overview;
}

async function fetchClinicStats() {
    const res = await fetch("/api/analytics/clinic", { credentials: "include" });
    if (!res.ok) throw new Error("Failed");
    return (await res.json()).data.clinic;
}

export default function AnalyticsPage() {
    const { data: user } = useCurrentUser();

    const { data: overview, isLoading: ovLoading, isError } = useQuery({
        queryKey: ["analytics-overview"],
        queryFn: fetchOverview,
        enabled: !!user,
    });

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["clinic-stats"],
        queryFn: fetchClinicStats,
        enabled: !!user,
    });

    const totalStatusCount = overview?.statusBreakdown.reduce((s, r) => s + r._count.id, 0) || 1;

    return (
        <DashboardLayout title="Analytics">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Analytics & Reports</h2>
                    <p className="text-slate-500">Performance insights across appointments, revenue, and patients.</p>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { label: "Total Patients", value: statsLoading ? null : stats?.totalPatients, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Total Appointments", value: statsLoading ? null : stats?.totalAppointments, icon: Calendar, color: "text-teal-600", bg: "bg-teal-50" },
                    { label: "Completion Rate", value: statsLoading ? null : `${(stats?.completionRate ?? 0).toFixed(1)}%`, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Staff Members", value: statsLoading ? null : stats?.totalStaff, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
                ].map((kpi, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                                    {kpi.value === null ? <Skeleton className="h-8 w-16 mt-2" /> : <p className="text-3xl font-bold text-slate-900 mt-1">{kpi.value}</p>}
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isError && (
                <Card className="border-none ring-1 ring-red-100 bg-red-50 mb-6">
                    <CardContent className="p-4 text-red-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Failed to load analytics data.
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Appointment Volume Chart */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-teal-600" /> Appointments (Last 6 Months)
                        </CardTitle>
                        <CardDescription>Monthly appointment volume</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {ovLoading ? <Skeleton className="h-40 w-full" /> : overview ? <BarChart data={overview.monthlyData} /> : null}
                    </CardContent>
                </Card>

                {/* Revenue Chart */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-emerald-600" /> Revenue (Last 6 Months)
                        </CardTitle>
                        <CardDescription>Monthly collected revenue (GH₵)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {ovLoading ? <Skeleton className="h-40 w-full" /> : overview ? <RevenueChart data={overview.monthlyData} /> : null}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Appointment Status Breakdown */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Appointment Status</CardTitle>
                        <CardDescription>All-time breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ovLoading ? (
                            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                        ) : overview?.statusBreakdown.map(row => {
                            const pct = Math.round((row._count.id / totalStatusCount) * 100);
                            const barColor = STATUS_COLORS[row.status] ?? "bg-slate-300";
                            return (
                                <div key={row.status}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-slate-700">{row.status.replace("_", " ")}</span>
                                        <span className="text-slate-500">{row._count.id} ({pct}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full">
                                        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Top Services */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Top Services</CardTitle>
                        <CardDescription>By appointment count</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ovLoading ? (
                            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                        ) : overview?.serviceBreakdown.map((s, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-8 rounded-full ${CATEGORY_COLORS[s.category] ?? "bg-slate-300"}`} />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 leading-tight">{s.name}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">{s.category}</p>
                                    </div>
                                </div>
                                <Badge className="bg-slate-100 text-slate-700 border-none font-bold">
                                    {s._count.appointments}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Top Patients */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Most Active Patients</CardTitle>
                        <CardDescription>By visit count</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {ovLoading ? (
                            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                        ) : overview?.topPatients.map((p, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 text-xs shrink-0">
                                    {p.firstName[0]}{p.lastName[0]}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-800">{p.firstName} {p.lastName}</p>
                                    <p className="text-xs text-slate-400">{p._count.appointments} visits</p>
                                </div>
                                <div className="w-full max-w-[60px] h-1.5 bg-slate-100 rounded-full">
                                    <div className="h-1.5 rounded-full bg-teal-500"
                                        style={{ width: `${Math.min((p._count.appointments / (overview.topPatients[0]?._count.appointments || 1)) * 100, 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
