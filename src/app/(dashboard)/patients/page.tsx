"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Users, Plus, Search, Mail, Phone as PhoneIcon, History,
    ChevronLeft, ChevronRight, Loader2, AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    gender?: string;
    lastVisitAt?: string;
    isVerified: boolean;
    _count: { appointments: number };
}

function initials(first: string, last: string) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatDate(dateStr?: string) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function fetchPatients(tenantId: string, search: string, page: number) {
    const params = new URLSearchParams({ tenantId, page: String(page), limit: "20" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/patients?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch patients");
    const json = await res.json();
    return json.data as { patients: Patient[]; pagination: { total: number; totalPages: number; page: number } };
}

export default function PatientsPage() {
    const { data: user } = useCurrentUser();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search, 350);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["patients", user?.tenantId, debouncedSearch, page],
        queryFn: () => fetchPatients(user!.tenantId!, debouncedSearch, page),
        enabled: !!user?.tenantId,
    });

    const patients = data?.patients ?? [];
    const pagination = data?.pagination;

    return (
        <DashboardLayout title="Patient Registry">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Patients</h2>
                    <p className="text-slate-500">Search, manage, and register patients in your clinic.</p>
                </div>
                <div className="flex gap-3">
                    <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                        <Plus className="w-4 h-4" /> New Patient
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                    placeholder="Search by name, phone, or email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="h-14 pl-12 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-teal-500 text-lg"
                />
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
            )}

            {isError && (
                <Card className="border-none shadow-sm ring-1 ring-red-100 bg-red-50">
                    <CardContent className="p-6 flex items-center gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>Failed to load patients. <button className="underline" onClick={() => refetch()}>Retry</button></p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && patients.length === 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-12 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">{search ? "No patients match your search" : "No patients registered yet"}</p>
                        <p className="text-sm mt-1">Add your first patient to get started.</p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && patients.length > 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Patient</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Contact</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Last Visit</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Appointments</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {patients.map((patient) => (
                                    <tr key={patient.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 uppercase text-sm">
                                                    {initials(patient.firstName, patient.lastName)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {patient.id.slice(-6).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-slate-600 flex items-center gap-2">
                                                    <PhoneIcon className="w-3 h-3" /> {patient.phone}
                                                </p>
                                                {patient.email && (
                                                    <p className="text-xs text-slate-600 flex items-center gap-2">
                                                        <Mail className="w-3 h-3" /> {patient.email}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {formatDate(patient.lastVisitAt)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-700">
                                            {patient._count.appointments}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className={`border-none font-bold ${patient.isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                                {patient.isVerified ? "Verified" : "Unverified"}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-teal-600">
                                                    <History className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                            <p className="text-sm text-slate-500">
                                {pagination.total} patients total
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === pagination.totalPages}>
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </DashboardLayout>
    );
}
