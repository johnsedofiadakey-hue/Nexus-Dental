"use client";

import { useState } from "react";
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
    Heart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Link from "next/link";

/**
 * Patient Portal Dashboard
 */
export default function PatientPortal() {
    return (
        <DashboardLayout
            role="PATIENT"
            title="My Health Portal"
            userName="John Doe"
            userRoleLabel="Patient Member"
        >
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-teal-600 p-8 text-white mb-8 shadow-lg shadow-teal-600/20">
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-3xl font-heading font-bold mb-2">Welcome back, John!</h2>
                    <p className="text-teal-50 opacity-90 text-lg mb-6">You have an upcoming appointment tomorrow with Dr. Kwame Asante. Remember to arrive 15 minutes early.</p>
                    <div className="flex flex-wrap gap-4">
                        <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50 gap-2 border-none">
                            <Plus className="w-5 h-5" /> Book New Appointment
                        </Button>
                        <Button size="lg" variant="outline" className="border-teal-400 text-white hover:bg-teal-500 gap-2">
                            View Records <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                {/* Abstract Background Shapes */}
                <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] bg-teal-500 rounded-full blur-[80px] opacity-40 shrink-0" />
                <div className="absolute bottom-[-10%] left-[20%] w-[200px] h-[200px] bg-sky-400 rounded-full blur-[60px] opacity-20 shrink-0" />
                <Heart className="absolute bottom-6 right-8 w-16 h-16 text-teal-400 opacity-20 rotate-12" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main: Upcoming Appointments */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-900">Next Appointment</h3>
                            <Link href="/portal/bookings" className="text-sm font-semibold text-teal-600 hover:underline">View All</Link>
                        </div>

                        <Card className="border-none shadow-md ring-1 ring-slate-100 overflow-hidden">
                            <div className="bg-teal-50 px-6 py-3 flex items-center justify-between border-b border-teal-100">
                                <div className="flex items-center gap-2 text-teal-700 font-bold text-xs uppercase tracking-widest">
                                    <Clock className="w-3.5 h-3.5" /> Tomorrow, Feb 17
                                </div>
                                <Badge className="bg-white text-teal-700 shadow-sm border-teal-100">Confirmed</Badge>
                            </div>
                            <CardContent className="p-8">
                                <div className="flex flex-col md:flex-row gap-8">
                                    <div className="flex flex-col items-center text-center md:text-left md:items-start gap-4 pr-8 md:border-r border-slate-100">
                                        <div className="w-20 h-20 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-2xl font-bold">KA</div>
                                        <div>
                                            <h4 className="font-bold text-lg text-slate-900">Dr. Kwame Asante</h4>
                                            <p className="text-slate-500 text-sm">General Dentistry Specialist</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Stethoscope className="w-3 h-3" /> Service
                                                </p>
                                                <p className="font-semibold text-slate-800">Routine Checkup & Cleaning</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <MapPin className="w-3 h-3" /> Location
                                                </p>
                                                <p className="font-semibold text-slate-800">Airport Hills Dental, Suite 204</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3" /> Time
                                                </p>
                                                <p className="font-semibold text-slate-800">09:30 AM (45 mins)</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            <Button className="bg-teal-600 hover:bg-teal-700 shadow-teal-600/10">Reschedule</Button>
                                            <Button variant="outline" className="text-slate-600 border-slate-200">Cancel Appointment</Button>
                                            <Button variant="ghost" className="text-teal-600 hover:bg-teal-50 ml-auto">Directions</Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Past Sessions</h3>
                        <div className="space-y-4">
                            {[1, 2].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white ring-1 ring-slate-100 hover:shadow-md transition-all">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">Teeth Whitening Session</h4>
                                            <p className="text-sm text-slate-500">Jan 12, 2026 • Dr. Ama Mensah</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-teal-600">
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar: Health Advice / Support */}
                <div className="space-y-8">
                    <Card className="border-none shadow-md ring-1 ring-slate-100 bg-amber-50/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Video className="w-5 h-5 text-amber-600" /> Virtual Consultation
                            </CardTitle>
                            <CardDescription>Speak with a dentist online right now</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-600 mb-6">Need urgent advice? Our online dentists are available 24/7 for dental triage and emergency consultations.</p>
                            <Button className="w-full bg-amber-600 hover:bg-amber-700 shadow-amber-600/10 gap-2">
                                Join Virtual Waiting Room <ArrowRight className="w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardHeader>
                            <CardTitle className="text-lg">My Support Tickets</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-sm font-bold text-slate-900">Billing Inquiry</p>
                                    <Badge variant="warning" className="text-[9px] h-3.5">Open</Badge>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">I missed a discount code on my previous whitening session...</p>
                                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Update 2h ago</p>
                            </div>
                            <Button variant="ghost" className="w-full text-teal-600 hover:bg-teal-50">View All Tickets</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
