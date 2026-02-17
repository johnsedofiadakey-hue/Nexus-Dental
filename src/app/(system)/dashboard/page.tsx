"use client";

import { useState, useEffect } from "react";
import {
    BarChart,
    LineChart,
    PieChart,
    TrendingUp,
    Users,
    Calendar,
    DollarSign,
    ArrowUpRight,
    Filter,
    Download,
    CalendarDays,
    Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

interface PlatformStats {
    activePatients: number;
    patientGrowth: number;
    totalAppointments: number;
    completedAppointments: number;
    completionRate: number;
    totalTenants: number;
    activeTenants: number;
}

/**
 * Global Analytics View for System Owners
 */
export default function AnalyticsDashboard() {
    const [range, setRange] = useState("Last 30 Days");
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch("/api/analytics/platform");
                if (res.ok) {
                    const data = await res.json();
                    setStats(data.platform);
                }
            } catch (error) {
                console.error("Failed to fetch platform stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="System Intelligence"
            userName="Super Admin"
            userRoleLabel="Global Controller"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-900">Performance Analytics</h2>
                    <p className="text-slate-500">Real-time metrics across all active tenants and clinical operations</p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <CalendarDays className="w-4 h-4" /> {range}
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" /> Export Report
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700">
                        <Filter className="w-4 h-4" /> Filter Views
                    </Button>
                </div>
            </div>

            {/* Primary KPI Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100">
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-32" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-24 mb-2" />
                                <Skeleton className="h-4 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Active Patients</CardTitle>
                            <Users className="w-4 h-4 text-slate-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">{stats.activePatients.toLocaleString()}</div>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant={stats.patientGrowth >= 0 ? "success" : "secondary"} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none">
                                    {stats.patientGrowth >= 0 ? '+' : ''}{stats.patientGrowth.toFixed(1)}%
                                </Badge>
                                <span className="text-xs text-slate-500">vs last week</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Total Appointments</CardTitle>
                            <Calendar className="w-4 h-4 text-slate-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">{stats.totalAppointments.toLocaleString()}</div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-slate-500">{stats.completedAppointments} completed</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Completion Rate</CardTitle>
                            <TrendingUp className="w-4 h-4 text-slate-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900">{stats.completionRate.toFixed(1)}%</div>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="success" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none">
                                    Target: 95%
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Failed to load statistics</p>
                </div>
            )}

            {/* Charts Section Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Revenue Growth</CardTitle>
                        <CardDescription>Daily financial performance for all tenants combined</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center bg-slate-50 rounded-xl m-6 mt-0 border border-dashed border-slate-200">
                        <div className="text-center">
                            <LineChart className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-400 font-medium">Main Revenue Chart Visualization</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Service Distribution</CardTitle>
                        <CardDescription>Popularity of clinical services by volume</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center bg-slate-50 rounded-xl m-6 mt-0 border border-dashed border-slate-200">
                        <div className="text-center">
                            <PieChart className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-400 font-medium">Service Popuarity Chart Visualization</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Data Table Placeholder */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100">
                <CardHeader>
                    <CardTitle>Tenant Performance Ranking</CardTitle>
                    <CardDescription>Detailed breakdown of individual clinic performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { name: "Ridge Dental Clinic", rev: "GH₵ 42,000", appt: "840", health: "Healthy" },
                            { name: "Airport Hills Dental", rev: "GH₵ 38,500", appt: "720", health: "Healthy" },
                            { name: "West Legon Clinic", rev: "GH₵ 31,200", appt: "640", health: "Degraded" },
                            { name: "Osu Smiles Center", rev: "GH₵ 28,400", appt: "590", health: "Healthy" },
                        ].map((tenant, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                        {tenant.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900">{tenant.name}</h4>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">{tenant.health}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-12 text-right">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Revenue</p>
                                        <p className="font-bold text-slate-900">{tenant.rev}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Appointments</p>
                                        <p className="font-bold text-slate-900">{tenant.appt}</p>
                                    </div>
                                    <Button variant="ghost" size="icon">
                                        <ArrowUpRight className="w-4 h-4 text-teal-600" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
