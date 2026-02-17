"use client";

import {
    Users,
    Calendar,
    CreditCard,
    ArrowUpRight,
    TrendingUp,
    Clock,
    CheckCircle2,
    CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";

export default function ClinicDashboard() {
    return (
        <DashboardLayout
            role="CLINIC_OWNER"
            title="Clinic Overview"
            userName="Clinic Manager"
            userRoleLabel="Administrator"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-900">Dashboard</h2>
                    <p className="text-slate-500">Welcome back. Here is what&apos;s happening at your clinic today.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <CalendarDays className="w-4 h-4" /> Today
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700">
                        Generate Report
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { label: "Total Patients", value: "1,284", sub: "+12 this month", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Appointments", value: "24", sub: "8 scheduled for today", icon: Calendar, color: "text-teal-600", bg: "bg-teal-50" },
                    { label: "Revenue", value: "GH₵ 12.4k", sub: "15% increase vs last week", icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Pending Tasks", value: "7", sub: "Requires attention", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                ].map((stat, i) => (
                    <Card key={i} className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                    <div className="flex items-center gap-1 mt-2">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-xs text-slate-600 font-medium">{stat.sub}</span>
                                    </div>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg}`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upcoming Appointments */}
                <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Today&apos;s Schedule</CardTitle>
                            <CardDescription>Review upcoming patient appointments</CardDescription>
                        </div>
                        <Button variant="ghost" className="text-teal-600 text-sm">View Calendar</Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 uppercase">
                                            JD
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">John Doe</p>
                                            <p className="text-xs text-slate-500">Routine Checkup • 10:30 AM</p>
                                        </div>
                                    </div>
                                    <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-none font-bold">Confirmed</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {[
                                { msg: "New patient registered", time: "2m ago", icon: Users, color: "text-blue-600" },
                                { msg: "Payment received: GH₵ 450", time: "15m ago", icon: CreditCard, color: "text-emerald-600" },
                                { msg: "Appointment completed", time: "1h ago", icon: CheckCircle2, color: "text-teal-600" },
                            ].map((activity, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-50`}>
                                        <activity.icon className={`w-4 h-4 ${activity.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{activity.msg}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
