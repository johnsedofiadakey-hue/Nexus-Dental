"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Pill, Search, User as UserIcon, Calendar, CheckCircle,
    Clock, AlertCircle, Loader2, PackageCheck, Filter
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Prescription {
    id: string;
    patient: {
        firstName: string;
        lastName: string;
    };
    doctor: {
        firstName: string;
        lastName: string;
    };
    medications: any[];
    status: "PENDING" | "DISPENSED" | "CANCELLED";
    issuedAt: string;
}

export default function PharmacyPage() {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [userContext, setUserContext] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("PENDING");
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                // Fetch User Context
                const meRes = await fetch("/api/auth/me");
                const meData = await meRes.json();
                if (meData.success) {
                    setUserContext(meData.data);
                }

                // Fetch Prescriptions
                await fetchPrescriptions();
            } catch (error) {
                toast.error("Failed to load clinical data");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [filterStatus]);

    const fetchPrescriptions = async () => {
        try {
            const res = await fetch(`/api/prescriptions?status=${filterStatus}`);
            const data = await res.json();
            if (data.success) {
                setPrescriptions(data.data);
            }
        } catch (error) {
            toast.error("Failed to load prescriptions");
        }
    };

    const handleDispense = async (id: string) => {
        if (!confirm("Confirm medication dispensing? This will deduct stock from inventory.")) return;

        setProcessingId(id);
        try {
            const res = await fetch(`/api/prescriptions/${id}/dispense`, {
                method: "POST",
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Medication dispensed and inventory updated");
                fetchPrescriptions();
            } else {
                toast.error(data.error || "Dispensing failed");
            }
        } catch (error) {
            toast.error("An error occurred during fulfillment");
        } finally {
            setProcessingId(null);
        }
    };

    const filteredPrescriptions = prescriptions.filter(p =>
        `${p.patient.firstName} ${p.patient.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!userContext) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <DashboardLayout
            title="Pharmacy Queue"
            role={userContext.role}
            roles={userContext.roles}
            userName={`${userContext.firstName} ${userContext.lastName}`}
            userRoleLabel={userContext.role}
        >
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold flex items-center gap-2">
                            <Pill className="w-8 h-8 text-indigo-600" />
                            Dispensing Queue
                        </h2>
                        <p className="text-muted-foreground">Fulfill and track clinical prescriptions</p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <Button
                            variant={filterStatus === "PENDING" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setFilterStatus("PENDING")}
                            className={cn(filterStatus === "PENDING" && "shadow-sm bg-white")}
                        >
                            Pending
                        </Button>
                        <Button
                            variant={filterStatus === "DISPENSED" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setFilterStatus("DISPENSED")}
                            className={cn(filterStatus === "DISPENSED" && "shadow-sm bg-white")}
                        >
                            Fulfilled
                        </Button>
                        <Button
                            variant={filterStatus === "ALL" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setFilterStatus("ALL")}
                            className={cn(filterStatus === "ALL" && "shadow-sm bg-white")}
                        >
                            All
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Patient Name or Prescription ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 bg-white"
                        />
                    </div>
                    <Button variant="outline" className="gap-2 h-11">
                        <Filter className="w-4 h-4" />
                        Advanced Filter
                    </Button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                        <p className="text-muted-foreground font-medium">Fetching clinical prescriptions...</p>
                    </div>
                ) : filteredPrescriptions.length === 0 ? (
                    <Card className="border-dashed py-20 text-center">
                        <Pill className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                        <h3 className="text-xl font-semibold text-slate-900">No prescriptions found</h3>
                        <p className="text-muted-foreground">There are no prescriptions matching your criteria.</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredPrescriptions.map((p) => (
                            <Card key={p.id} className="hover:border-indigo-200 transition-colors bg-white">
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="space-y-4 flex-1">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="text-xl font-bold text-slate-900">
                                                            {p.patient.firstName} {p.patient.lastName}
                                                        </h3>
                                                        <Badge variant={p.status === "PENDING" ? "warning" : "success"}>
                                                            {p.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">#{p.id}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <UserIcon className="w-3 h-3" /> Dr. {p.doctor.firstName} {p.doctor.lastName}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-slate-500 flex items-center gap-1 justify-end">
                                                        <Clock className="w-3.5 h-3.5" /> Issued
                                                    </p>
                                                    <p className="text-sm font-bold text-slate-900">
                                                        {new Date(p.issuedAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                                                    <PackageCheck className="w-3.5 h-3.5" /> Prescribed Medications
                                                </h4>
                                                <ul className="space-y-3">
                                                    {p.medications.map((med: any, idx: number) => (
                                                        <li key={idx} className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-100">
                                                                    <Pill className="w-4 h-4 text-indigo-500" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-700">{med.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{med.dosage} • {med.frequency}</p>
                                                                </div>
                                                            </div>
                                                            <Badge variant="outline" className="bg-white">x{med.quantity || 1}</Badge>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="md:w-64 flex flex-col justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 space-y-3">
                                            {p.status === "PENDING" ? (
                                                <>
                                                    <Button
                                                        className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2 h-12 shadow-sm text-white"
                                                        onClick={() => handleDispense(p.id)}
                                                        disabled={processingId === p.id}
                                                    >
                                                        {processingId === p.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="w-4 h-4" />
                                                        )}
                                                        Dispense Meds
                                                    </Button>
                                                    <Button variant="outline" className="w-full gap-2 text-rose-600 hover:bg-rose-50 border-rose-100 h-12">
                                                        Cancel Order
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="text-center space-y-2 py-4">
                                                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                                                        <CheckCircle className="w-6 h-6" />
                                                    </div>
                                                    <p className="text-sm font-bold text-emerald-700">Order Fulfilled</p>
                                                    <Button variant="ghost" size="sm" className="text-xs text-slate-500">Download Receipt</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
