"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Calendar, FileText, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

interface ClinicStats {
    totalPatients: number;
    totalAppointments: number;
    completedAppointments: number;
    completionRate: number;
    totalStaff: number;
    revenue: number;
    monthlyRevenue: number;
}

async function fetchClinicStats(): Promise<ClinicStats> {
    const res = await fetch("/api/analytics/clinic", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch stats");
    const json = await res.json();
    return json.data.clinic as ClinicStats;
}

function StatCard({
    label, value, sub, icon: Icon, iconColor,
}: { label: string; value: string; sub: string; icon: React.ElementType; iconColor: string }) {
    return (
        <Card className="border-none shadow-sm ring-1 ring-slate-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`w-4 h-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
        </Card>
    );
}

function StatCardSkeleton() {
    return (
        <Card className="border-none shadow-sm ring-1 ring-slate-100">
            <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-7 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
            </CardContent>
        </Card>
    );
}

export default function FinanceDashboardPage() {
    const { data: user } = useCurrentUser();

    const { data: stats, isLoading, isError, refetch } = useQuery({
        queryKey: ["clinic-stats"],
        queryFn: fetchClinicStats,
        enabled: !!user,
    });

    return (
        <DashboardLayout title="Finance Dashboard">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Finance Overview</h2>
                <p className="text-slate-500">Revenue, billing, and clinic performance metrics.</p>
            </div>

            {isError && (
                <Card className="border-none shadow-sm ring-1 ring-red-100 bg-red-50 mb-6">
                    <CardContent className="p-4 flex items-center gap-3 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Failed to load stats.{" "}
                        <button className="underline" onClick={() => refetch()}>Retry</button>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCard
                            label="Total Revenue"
                            value={`GH₵ ${(stats?.revenue ?? 0).toLocaleString()}`}
                            sub="Lifetime invoiced amount"
                            icon={DollarSign}
                            iconColor="text-teal-600"
                        />
                        <StatCard
                            label="Total Appointments"
                            value={String(stats?.totalAppointments ?? 0)}
                            sub={`${stats?.completedAppointments ?? 0} completed`}
                            icon={Calendar}
                            iconColor="text-blue-600"
                        />
                        <StatCard
                            label="Completion Rate"
                            value={`${(stats?.completionRate ?? 0).toFixed(1)}%`}
                            sub="Appointments completed vs scheduled"
                            icon={TrendingUp}
                            iconColor="text-emerald-600"
                        />
                        <StatCard
                            label="Total Patients"
                            value={String(stats?.totalPatients ?? 0)}
                            sub={`${stats?.totalStaff ?? 0} staff members`}
                            icon={Users}
                            iconColor="text-purple-600"
                        />
                    </>
                )}
            </div>

            <Card className="border-none shadow-sm ring-1 ring-slate-100">
                <CardHeader>
                    <CardTitle>Recent Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground text-center py-12">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                        <p className="font-medium">Invoice management coming soon</p>
                        <p className="text-xs mt-2">Full billing, insurance claims, and payment tracking will appear here.</p>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
