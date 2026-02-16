"use client";

import { useState } from "react";
import {
    Users,
    Calendar,
    Clock,
    CheckCircle2,
    Timer,
    MoreVertical,
    Plus,
    Search,
    ArrowUpRight,
    TrendingUp,
    CreditCard,
    Package,
    LifeBuoy,
    Settings,
    ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

/**
 * Mock Clinical Dashboard for Staff
 */
export default function ClinicalDashboard() {
    const [activeTab, setActiveTab] = useState<"UPCOMING" | "IN_PROGRESS" | "COMPLETED">("UPCOMING");

    return (
        <DashboardLayout
            role="STAFF"
            title="Clinical Operations"
            userName="Dr. Kwame Asante"
            userRoleLabel="Senior Dentist"
        >
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { label: "Today's Appointments", value: "12", sub: "+2 from yesterday", icon: Calendar, color: "text-teal-600", bg: "bg-teal-50" },
                    { label: "Patients Waiting", value: "4", sub: "Avg wait: 12m", icon: Timer, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Completed Sessions", value: "6", sub: "8 pending", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Revenue (Today)", value: "GH₵ 4.2k", sub: "15% vs last week", icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50" },
                ].map((stat, i) => (
                    <Card key={i} className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                    <h3 className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                    <div className="flex items-center gap-1 mt-2">
                                        <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                                        <span className="text-xs text-slate-600 font-medium">{stat.sub}</span>
                                    </div>
                                </div>
                                <div className={cn("p-3 rounded-xl", stat.bg)}>
                                    <stat.icon className={cn("w-6 h-6", stat.color)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Appointment Board */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle>Appointment Queue</CardTitle>
                                <CardDescription>Manage today&apos;s patient flow and clinical sessions</CardDescription>
                            </div>
                            <Button size="sm" className="gap-2">
                                <Plus className="w-4 h-4" /> New Booking
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {/* Filter Tabs */}
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6">
                                {[
                                    { id: "UPCOMING", label: "Upcoming" },
                                    { id: "IN_PROGRESS", label: "In Progress" },
                                    { id: "COMPLETED", label: "Completed" },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                                            activeTab === tab.id
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Appointment List */}
                            <div className="space-y-4">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 hover:border-teal-100 transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            {/* Avatar/Time */}
                                            <div className="text-center min-w-[60px] pr-4 border-r border-slate-100">
                                                <p className="text-lg font-bold text-slate-900">09:30</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">AM</p>
                                            </div>

                                            {/* Patient Info */}
                                            <div>
                                                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                                    John Doe
                                                    <Badge variant="success" className="text-[10px] h-4">Check-in</Badge>
                                                </h4>
                                                <p className="text-sm text-slate-500">Service: Routine Cleaning • 45m</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                View Records
                                            </Button>
                                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                                                Start Session
                                            </Button>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Notifications / Recent Activity */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader>
                            <CardTitle className="text-lg">Recent Clinical Logs</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {[
                                { type: "INVENTORY", msg: "Composite Resin low in stock", time: "12m ago", icon: Package, color: "text-red-600", bg: "bg-red-50" },
                                { type: "SESSION", msg: "Session #4421 completed by Dr. Ama", time: "45m ago", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { type: "ALERT", msg: "New Emergency Booking (High Priority)", time: "1h ago", icon: ShieldAlert, color: "text-teal-600", bg: "bg-teal-50" },
                            ].map((log, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", log.bg)}>
                                        <log.icon className={cn("w-5 h-5", log.color)} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{log.type}</p>
                                        <p className="text-sm font-medium text-slate-900 mt-0.5">{log.msg}</p>
                                        <p className="text-xs text-slate-500 mt-1">{log.time}</p>
                                    </div>
                                </div>
                            ))}
                            <Button variant="ghost" className="w-full text-teal-600 hover:bg-teal-50 mt-2">
                                View All Activity
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
