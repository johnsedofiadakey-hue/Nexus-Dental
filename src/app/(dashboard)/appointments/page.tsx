"use client";

import {
    Calendar,
    Plus,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";

export default function AppointmentsPage() {
    return (
        <DashboardLayout
            role="RECEPTIONIST"
            title="Appointments"
            userName="Reception Desk"
            userRoleLabel="Front Desk"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-900">Schedule Management</h2>
                    <p className="text-slate-500">Manage bookings, check-ins, and doctor availability.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Filter className="w-4 h-4" /> Filters
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                        <Plus className="w-4 h-4" /> New Booking
                    </Button>
                </div>
            </div>

            {/* Calendar Header */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 mb-8">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xl font-bold text-slate-900">February 2024</h3>
                            <div className="flex border rounded-lg overflow-hidden">
                                <Button variant="ghost" size="icon" className="rounded-none border-r"><ChevronLeft className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="rounded-none"><ChevronRight className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm">Day</Button>
                            <Button variant="default" size="sm" className="bg-teal-600">Week</Button>
                            <Button variant="secondary" size="sm">Month</Button>
                        </div>
                    </div>

                    <div className="relative border rounded-2xl overflow-hidden bg-slate-50 p-12 text-center text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">Interactive Calendar Visualization</p>
                        <p className="text-sm">Connect to Google/Outlook Calendar in Settings</p>
                    </div>
                </CardContent>
            </Card>

            {/* Upcoming List */}
            <div className="space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-600" /> Upcoming Today
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((_, i) => (
                        <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 font-bold">
                                        JD
                                    </div>
                                    <Badge className="bg-teal-50 text-teal-700 border-none font-bold">10:30 AM</Badge>
                                </div>
                                <h5 className="font-bold text-slate-900">John Doe</h5>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Routine Cleaning</p>
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <MapPin className="w-3 h-3" /> Room 102
                                    </div>
                                    <Button size="sm" variant="ghost" className="text-teal-600 h-8">Details</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
