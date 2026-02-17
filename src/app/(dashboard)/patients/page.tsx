"use client";

import {
    Users,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Mail,
    Phone as PhoneIcon,
    History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";

export default function PatientsPage() {
    return (
        <DashboardLayout
            role="RECEPTIONIST"
            title="Patient Registry"
            userName="Reception Desk"
            userRoleLabel="Front Desk"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-900">Patients</h2>
                    <p className="text-slate-500">Search, manage, and register patients in your clinic.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Filter className="w-4 h-4" /> Filters
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                        <Plus className="w-4 h-4" /> New Patient
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                    placeholder="Search by name, ID, or phone number..."
                    className="h-14 pl-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-teal-500 text-lg"
                />
            </div>

            {/* Patient Table */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Patient</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Contact</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Last Visit</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 uppercase">
                                                KA
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">Kwame Asante</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">ID: ND-00{i + 1}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-600 flex items-center gap-2"><PhoneIcon className="w-3 h-3" /> +233 24 000 0000</p>
                                            <p className="text-xs text-slate-600 flex items-center gap-2"><Mail className="w-3 h-3" /> kwame@example.com</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        Feb 12, 2024
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold">Active</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-teal-600">
                                                <History className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-teal-600">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </DashboardLayout>
    );
}
