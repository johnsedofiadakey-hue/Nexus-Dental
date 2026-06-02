"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Calendar,
    MapPin,
    User,
    Video,
    ChevronRight,
    Clock,
    FileText,
    Plus,
    ArrowRight,
    Stethoscope,
    Heart,
    Pill,
    AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import Link from "next/link";
function formatAppointmentDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    if (d.toDateString() === now.toDateString()) return `Today, ${fmt(d)}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${fmt(d)}`;
    return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function statusColor(status: string) {
    switch (status) {
        case "CONFIRMED": return "bg-teal-50 text-teal-700 border-teal-100";
        case "PENDING": return "bg-amber-50 text-amber-700 border-amber-100";
        case "CANCELLED": return "bg-red-50 text-red-700 border-red-100";
        case "COMPLETED": return "bg-slate-100 text-slate-600 border-slate-200";
        default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
}

export default function PatientPortal() {
    const { data: user, isLoading: userLoading } = useCurrentUser();

    const today = new Date().toISOString().split("T")[0];

    const { data: appointmentsData, isLoading: apptLoading } = useQuery({
        queryKey: ["patient-appointments", user?.id, user?.tenantId],
        queryFn: async () => {
            const res = await fetch(
                `/api/appointments?tenantId=${user!.tenantId}&patientId=${user!.id}&dateFrom=${today}`,
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to fetch appointments");
            return res.json();
        },
        enabled: !!user?.id && !!user?.tenantId,
    });

    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ["patient-history", user?.id],
        queryFn: async () => {
            const res = await fetch(`/api/patients/${user!.id}/history`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json();
        },
        enabled: !!user?.id,
    });

    const appointments: any[] = appointmentsData?.data?.appointments ?? appointmentsData?.data ?? appointmentsData ?? [];
    const nextAppointment = appointments[0] ?? null;

    const history = historyData?.data ?? historyData ?? {};
    const prescriptions: any[] = history?.prescriptions ?? [];
    const pastAppointments: any[] = (history?.appointments ?? []).filter(
        (a: any) => a.status === "COMPLETED"
    ).slice(0, 2);

    const recentPrescription = prescriptions[0] ?? null;

    const firstName = user?.firstName ?? "there";
    const fullName = user ? `${user.firstName} ${user.lastName}` : "";

    const isLoading = userLoading || apptLoading || historyLoading;

    return (
        <DashboardLayout title="My Health Portal">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-teal-600 p-8 text-white mb-8 shadow-lg shadow-teal-600/20">
                <div className="relative z-10 max-w-2xl">
                    {userLoading ? (
                        <Skeleton className="h-9 w-56 bg-teal-500 mb-2" />
                    ) : (
                        <h2 className="text-3xl font-heading font-bold mb-2">
                            Welcome back, {firstName}!
                        </h2>
                    )}
                    <p className="text-teal-50 opacity-90 text-lg mb-6">
                        {nextAppointment
                            ? `You have an upcoming appointment on ${formatAppointmentDate(nextAppointment.dateTime ?? nextAppointment.date)}. Remember to arrive 15 minutes early.`
                            : "You have no upcoming appointments. Book one to stay on top of your dental health."}
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Button asChild size="lg" className="bg-white text-teal-700 hover:bg-teal-50 gap-2 border-none">
                            <Link href="/booking">
                                <Plus className="w-5 h-5" /> Book New Appointment
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="border-teal-400 text-white hover:bg-teal-500 gap-2">
                            <Link href="/portal/records">
                                View Records <ArrowRight className="w-4 h-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
                <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-teal-500 rounded-full blur-[80px] opacity-40 shrink-0" />
                <div className="absolute bottom-[-10%] left-[20%] w-[200px] h-[200px] bg-sky-400 rounded-full blur-[60px] opacity-20 shrink-0" />
                <Heart className="absolute bottom-6 right-8 w-16 h-16 text-teal-400 opacity-20 rotate-12" />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <Link href="/booking">
                    <div className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white ring-1 ring-slate-100 hover:shadow-md hover:ring-teal-200 transition-all cursor-pointer text-center">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-teal-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800">Book Appointment</span>
                    </div>
                </Link>
                <Link href="/portal/records">
                    <div className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white ring-1 ring-slate-100 hover:shadow-md hover:ring-teal-200 transition-all cursor-pointer text-center">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800">View Records</span>
                    </div>
                </Link>
                <Link href="/portal/prescriptions">
                    <div className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white ring-1 ring-slate-100 hover:shadow-md hover:ring-teal-200 transition-all cursor-pointer text-center">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                            <Pill className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800">View Prescriptions</span>
                    </div>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main: Upcoming Appointment + Past Sessions */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-900">Next Appointment</h3>
                            <Link href="/portal/records" className="text-sm font-semibold text-teal-600 hover:underline">View All</Link>
                        </div>

                        {apptLoading ? (
                            <Card className="border-none shadow-md ring-1 ring-slate-100">
                                <CardContent className="p-8 space-y-4">
                                    <Skeleton className="h-6 w-40" />
                                    <Skeleton className="h-20 w-full" />
                                    <Skeleton className="h-10 w-48" />
                                </CardContent>
                            </Card>
                        ) : nextAppointment ? (
                            <Card className="border-none shadow-md ring-1 ring-slate-100 overflow-hidden">
                                <div className="bg-teal-50 px-6 py-3 flex items-center justify-between border-b border-teal-100">
                                    <div className="flex items-center gap-2 text-teal-700 font-bold text-xs uppercase tracking-widest">
                                        <Clock className="w-3.5 h-3.5" />
                                        {formatAppointmentDate(nextAppointment.dateTime ?? nextAppointment.date)}
                                        {nextAppointment.dateTime ? ` • ${new Date(nextAppointment.dateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
                                    </div>
                                    <Badge className={`shadow-sm border ${statusColor(nextAppointment.status)}`}>
                                        {nextAppointment.status}
                                    </Badge>
                                </div>
                                <CardContent className="p-8">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="flex flex-col items-center text-center md:text-left md:items-start gap-4 pr-8 md:border-r border-slate-100">
                                            <div className="w-20 h-20 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-2xl font-bold">
                                                {nextAppointment.doctor
                                                    ? getInitials(`${nextAppointment.doctor.firstName} ${nextAppointment.doctor.lastName}`)
                                                    : <User className="w-8 h-8" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-slate-900">
                                                    {nextAppointment.doctor
                                                        ? `Dr. ${nextAppointment.doctor.firstName} ${nextAppointment.doctor.lastName}`
                                                        : "Doctor TBD"}
                                                </h4>
                                                <p className="text-slate-500 text-sm">
                                                    {nextAppointment.doctor?.specialty ?? "Dental Specialist"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Stethoscope className="w-3 h-3" /> Service
                                                    </p>
                                                    <p className="font-semibold text-slate-800">
                                                        {nextAppointment.service?.name ?? nextAppointment.serviceType ?? "General Consultation"}
                                                    </p>
                                                </div>
                                                {nextAppointment.notes && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <FileText className="w-3 h-3" /> Notes
                                                        </p>
                                                        <p className="font-semibold text-slate-800">{nextAppointment.notes}</p>
                                                    </div>
                                                )}
                                                {nextAppointment.dateTime && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3" /> Time
                                                        </p>
                                                        <p className="font-semibold text-slate-800">
                                                            {new Date(nextAppointment.dateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-none shadow-sm ring-1 ring-slate-100">
                                <CardContent className="p-12 text-center">
                                    <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500 mb-4">No upcoming appointments.</p>
                                    <Button asChild className="bg-teal-600 hover:bg-teal-700">
                                        <Link href="/booking">Book Now</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </section>

                    <section>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Past Sessions</h3>
                        {historyLoading ? (
                            <div className="space-y-4">
                                {[0, 1].map((i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                                ))}
                            </div>
                        ) : pastAppointments.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-white ring-1 ring-slate-100 text-center text-slate-400">
                                No past sessions yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pastAppointments.map((appt: any) => (
                                    <div key={appt.id} className="flex items-center justify-between p-5 rounded-2xl bg-white ring-1 ring-slate-100 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900">
                                                    {appt.service?.name ?? "Appointment"}
                                                </h4>
                                                <p className="text-sm text-slate-500">
                                                    {appt.dateTime ? new Date(appt.dateTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                                    {appt.doctor ? ` • Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        <Link href="/portal/records">
                                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-teal-600">
                                                <ChevronRight className="w-5 h-5" />
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* Recent Prescription */}
                    <Card className="border-none shadow-md ring-1 ring-slate-100">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Pill className="w-5 h-5 text-purple-500" /> Latest Prescription
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-full" />
                                    <Skeleton className="h-5 w-3/4" />
                                </div>
                            ) : recentPrescription ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-700">
                                            {recentPrescription.items?.length ?? recentPrescription.medications?.length ?? 0} medication(s)
                                        </span>
                                        <Badge className={
                                            recentPrescription.status === "DISPENSED"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : recentPrescription.status === "CANCELLED"
                                                    ? "bg-red-50 text-red-700 border-red-100"
                                                    : "bg-amber-50 text-amber-700 border-amber-100"
                                        }>
                                            {recentPrescription.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {recentPrescription.createdAt
                                            ? new Date(recentPrescription.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                                            : "Recent"}
                                        {recentPrescription.doctor
                                            ? ` • Dr. ${recentPrescription.doctor.firstName} ${recentPrescription.doctor.lastName}`
                                            : ""}
                                    </p>
                                    <Button asChild variant="ghost" className="w-full text-purple-600 hover:bg-purple-50">
                                        <Link href="/portal/prescriptions">View All Prescriptions</Link>
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No prescriptions on record.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md ring-1 ring-slate-100 bg-amber-50/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Video className="w-5 h-5 text-amber-600" /> Virtual Consultation
                            </CardTitle>
                            <CardDescription>Speak with a dentist online right now</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-6">
                                Need urgent advice? Our online dentists are available 24/7 for dental triage and emergency consultations.
                            </p>
                            <Button className="w-full bg-amber-600 hover:bg-amber-700 shadow-amber-600/10 gap-2">
                                Join Virtual Waiting Room <ArrowRight className="w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
