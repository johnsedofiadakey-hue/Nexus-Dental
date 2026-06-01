"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FlaskConical,
    Plus,
    Search,
    Loader2,
    X,
    CheckCircle2,
    Clock,
    AlertTriangle,
    ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type LabOrderStatus = "ORDERED" | "LAB_RECEIVED" | "IN_FABRICATION" | "READY" | "FITTED" | "CANCELLED";

interface LabOrder {
    id: string;
    patientId: string;
    appointmentId?: string | null;
    doctorId: string;
    labName: string;
    labContact?: string | null;
    labEmail?: string | null;
    toothNumbers: number[];
    restoration: string;
    material?: string | null;
    shade?: string | null;
    instructions?: string | null;
    status: LabOrderStatus;
    orderedAt: string;
    dueAt?: string | null;
    receivedAt?: string | null;
    fittedAt?: string | null;
    cost?: number | null;
    notes?: string | null;
    createdAt: string;
    patient: { id: string; firstName: string; lastName: string };
    doctor: { id: string; firstName: string; lastName: string };
}

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LabOrderStatus, string> = {
    ORDERED: "Ordered",
    LAB_RECEIVED: "Lab Received",
    IN_FABRICATION: "In Fabrication",
    READY: "Ready",
    FITTED: "Fitted",
    CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<LabOrderStatus, string> = {
    ORDERED: "bg-blue-100 text-blue-800",
    LAB_RECEIVED: "bg-purple-100 text-purple-800",
    IN_FABRICATION: "bg-amber-100 text-amber-800",
    READY: "bg-emerald-100 text-emerald-800",
    FITTED: "bg-teal-100 text-teal-800",
    CANCELLED: "bg-slate-100 text-slate-600",
};

const NEXT_STATUS: Partial<Record<LabOrderStatus, LabOrderStatus>> = {
    ORDERED: "LAB_RECEIVED",
    LAB_RECEIVED: "IN_FABRICATION",
    IN_FABRICATION: "READY",
    READY: "FITTED",
};

const NEXT_STATUS_LABEL: Partial<Record<LabOrderStatus, string>> = {
    ORDERED: "Mark Lab Received",
    LAB_RECEIVED: "Mark In Fabrication",
    IN_FABRICATION: "Mark Ready",
    READY: "Mark as Fitted",
};

const RESTORATION_OPTIONS = [
    "Crown",
    "Bridge",
    "Denture",
    "Veneer",
    "Retainer",
    "Splint",
    "Implant Crown",
    "Partial Denture",
    "Night Guard",
];

const MATERIAL_OPTIONS = ["PFM", "Zirconia", "Composite", "Acrylic", "eMax", "Gold", "PMMA", "PFG"];

// FDI adult teeth
const FDI_TEETH = [
    11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44,
    45, 46, 47, 48,
];

const FILTER_TABS: { label: string; value: string }[] = [
    { label: "All", value: "all" },
    { label: "Ordered", value: "ORDERED" },
    { label: "In Progress", value: "in_progress" },
    { label: "Ready", value: "READY" },
    { label: "Fitted", value: "FITTED" },
];

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchLabOrders(search: string): Promise<LabOrder[]> {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/lab-orders?${params.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch lab orders");
    const json = await res.json();
    return json.data;
}

async function fetchPatients(q: string): Promise<Patient[]> {
    const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}&limit=10`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch patients");
    const json = await res.json();
    return json.data?.patients ?? json.data ?? [];
}

async function fetchDoctors(): Promise<{ id: string; firstName: string; lastName: string }[]> {
    const res = await fetch("/api/staff?role=DOCTOR", { credentials: "include" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function NewLabOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [patientSearch, setPatientSearch] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState("");
    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
    const [restoration, setRestoration] = useState("");
    const [material, setMaterial] = useState("");
    const [shade, setShade] = useState("");
    const [labName, setLabName] = useState("");
    const [labContact, setLabContact] = useState("");
    const [labEmail, setLabEmail] = useState("");
    const [instructions, setInstructions] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [cost, setCost] = useState("");
    const [showPatientList, setShowPatientList] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const { data: patients = [] } = useQuery({
        queryKey: ["patient-search", patientSearch],
        queryFn: () => fetchPatients(patientSearch),
        enabled: patientSearch.length >= 1,
        staleTime: 10_000,
    });

    const { data: doctors = [] } = useQuery({
        queryKey: ["doctors-list"],
        queryFn: fetchDoctors,
    });

    function toggleTooth(t: number) {
        setSelectedTeeth((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedPatient) return toast.error("Please select a patient");
        if (!selectedDoctor) return toast.error("Please select a doctor");
        if (!restoration) return toast.error("Please select restoration type");
        if (!labName) return toast.error("Please enter lab name");
        if (selectedTeeth.length === 0) return toast.error("Please select at least one tooth");

        setSubmitting(true);
        try {
            const res = await fetch("/api/lab-orders", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: selectedPatient.id,
                    doctorId: selectedDoctor,
                    labName,
                    labContact: labContact || undefined,
                    labEmail: labEmail || undefined,
                    toothNumbers: selectedTeeth,
                    restoration,
                    material: material || undefined,
                    shade: shade || undefined,
                    instructions: instructions || undefined,
                    dueAt: dueAt || undefined,
                    cost: cost ? Number(cost) : undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to create lab order");
            }
            toast.success("Lab order created successfully");
            onCreated();
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900">New Lab Order</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Patient Search */}
                    <div className="space-y-1 relative">
                        <label className="text-sm font-medium text-slate-700">Patient *</label>
                        {selectedPatient ? (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-teal-50">
                                <span className="text-sm text-slate-800 font-medium">
                                    {selectedPatient.firstName} {selectedPatient.lastName}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPatient(null)}
                                    className="ml-auto text-slate-400 hover:text-slate-600"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Input
                                    placeholder="Search patient by name..."
                                    value={patientSearch}
                                    onChange={(e) => {
                                        setPatientSearch(e.target.value);
                                        setShowPatientList(true);
                                    }}
                                    onFocus={() => setShowPatientList(true)}
                                />
                                {showPatientList && patients.length > 0 && (
                                    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                        {patients.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                                onClick={() => {
                                                    setSelectedPatient(p);
                                                    setShowPatientList(false);
                                                    setPatientSearch("");
                                                }}
                                            >
                                                {p.firstName} {p.lastName}{" "}
                                                <span className="text-slate-400">{p.phone}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Doctor */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Doctor *</label>
                        <select
                            value={selectedDoctor}
                            onChange={(e) => setSelectedDoctor(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="">Select doctor...</option>
                            {doctors.map((d) => (
                                <option key={d.id} value={d.id}>
                                    Dr. {d.firstName} {d.lastName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tooth Numbers */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                            Tooth Numbers (FDI) *{" "}
                            {selectedTeeth.length > 0 && (
                                <span className="text-teal-600">({selectedTeeth.sort((a, b) => a - b).join(", ")})</span>
                            )}
                        </label>
                        <div className="grid grid-cols-8 gap-1.5">
                            {FDI_TEETH.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => toggleTooth(t)}
                                    className={`rounded-md py-1.5 text-xs font-medium transition-colors border ${
                                        selectedTeeth.includes(t)
                                            ? "bg-teal-600 text-white border-teal-600"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-teal-400"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Restoration + Material + Shade */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Restoration *</label>
                            <select
                                value={restoration}
                                onChange={(e) => setRestoration(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">Select...</option>
                                {RESTORATION_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Material</label>
                            <select
                                value={material}
                                onChange={(e) => setMaterial(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">Select...</option>
                                {MATERIAL_OPTIONS.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Shade</label>
                            <Input placeholder="e.g. A2, B1" value={shade} onChange={(e) => setShade(e.target.value)} />
                        </div>
                    </div>

                    {/* Lab Info */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Lab Name *</label>
                            <Input
                                placeholder="Lab name"
                                value={labName}
                                onChange={(e) => setLabName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Lab Contact</label>
                            <Input
                                placeholder="Phone"
                                value={labContact}
                                onChange={(e) => setLabContact(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Lab Email</label>
                            <Input
                                type="email"
                                placeholder="lab@email.com"
                                value={labEmail}
                                onChange={(e) => setLabEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Due Date + Cost */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Due Date</label>
                            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Cost (₦)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Instructions</label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Special instructions for the lab..."
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Create Lab Order
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Lab Order Card ───────────────────────────────────────────────────────────

function LabOrderCard({ order, onStatusUpdate }: { order: LabOrder; onStatusUpdate: () => void }) {
    const isOverdue =
        order.dueAt &&
        order.status !== "FITTED" &&
        order.status !== "CANCELLED" &&
        new Date(order.dueAt) < new Date();

    const nextStatus = NEXT_STATUS[order.status];
    const nextStatusLabel = NEXT_STATUS_LABEL[order.status];

    const [updating, setUpdating] = useState(false);

    async function markNextStatus() {
        if (!nextStatus) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/lab-orders/${order.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            toast.success(`Order marked as ${STATUS_LABELS[nextStatus]}`);
            onStatusUpdate();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdating(false);
        }
    }

    async function cancelOrder() {
        if (!confirm("Cancel this lab order?")) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/lab-orders/${order.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to cancel order");
            toast.success("Lab order cancelled");
            onStatusUpdate();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdating(false);
        }
    }

    return (
        <div className="bg-white rounded-xl border-none shadow-sm ring-1 ring-slate-100 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-slate-900">
                        {order.patient.firstName} {order.patient.lastName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Dr. {order.doctor.firstName} {order.doctor.lastName} &middot; {order.labName}
                    </p>
                </div>
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}
                >
                    {STATUS_LABELS[order.status]}
                </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="bg-slate-100 rounded-md px-2 py-0.5">{order.restoration}</span>
                {order.material && <span className="bg-slate-100 rounded-md px-2 py-0.5">{order.material}</span>}
                {order.shade && <span className="bg-slate-100 rounded-md px-2 py-0.5">Shade: {order.shade}</span>}
                <span className="bg-slate-100 rounded-md px-2 py-0.5">
                    Teeth: {(order.toothNumbers as number[]).sort((a, b) => a - b).join(", ")}
                </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-3">
                    {order.dueAt && (
                        <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                            {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                            Due {new Date(order.dueAt).toLocaleDateString()}
                        </span>
                    )}
                    {order.cost != null && (
                        <span>₦{order.cost.toLocaleString()}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {order.status !== "CANCELLED" && order.status !== "FITTED" && (
                        <button
                            onClick={cancelOrder}
                            disabled={updating}
                            className="text-slate-400 hover:text-red-500 transition-colors text-xs"
                        >
                            Cancel
                        </button>
                    )}
                    {nextStatus && nextStatusLabel && (
                        <button
                            onClick={markNextStatus}
                            disabled={updating}
                            className="inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                            {updating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            {nextStatusLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabOrdersPage() {
    const { data: currentUser } = useCurrentUser();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [showModal, setShowModal] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const {
        data: labOrders = [],
        isLoading,
        refetch,
    } = useQuery<LabOrder[]>({
        queryKey: ["lab-orders", debouncedSearch],
        queryFn: () => fetchLabOrders(debouncedSearch),
        enabled: !!currentUser,
        staleTime: 30_000,
    });

    // Filter by tab
    const filtered = labOrders.filter((o) => {
        if (activeTab === "all") return true;
        if (activeTab === "in_progress")
            return o.status === "LAB_RECEIVED" || o.status === "IN_FABRICATION";
        return o.status === activeTab;
    });

    // Summary stats
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const total = labOrders.length;
    const pending = labOrders.filter((o) =>
        ["ORDERED", "LAB_RECEIVED", "IN_FABRICATION"].includes(o.status)
    ).length;
    const ready = labOrders.filter((o) => o.status === "READY").length;
    const fittedThisMonth = labOrders.filter(
        (o) => o.status === "FITTED" && o.fittedAt && new Date(o.fittedAt) >= startOfMonth
    ).length;

    return (
        <DashboardLayout title="Lab Orders">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Lab Orders</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Track prosthetics and restorations with dental labs</p>
                    </div>
                    <Button
                        onClick={() => setShowModal(true)}
                        className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                    >
                        <Plus size={16} />
                        New Lab Order
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Total Orders</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">{total}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <FlaskConical size={20} className="text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Pending</p>
                                    <p className="text-3xl font-bold text-amber-600 mt-1">{pending}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Clock size={20} className="text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Ready for Fitting</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-1">{ready}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 size={20} className="text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-slate-100">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Fitted This Month</p>
                                    <p className="text-3xl font-bold text-teal-600 mt-1">{fittedThisMonth}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                                    <CheckCircle2 size={20} className="text-teal-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <Input
                            placeholder="Search patient or lab name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        {FILTER_TABS.map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === tab.value
                                        ? "bg-white text-teal-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <Loader2 size={28} className="animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <FlaskConical size={40} className="text-slate-200 mb-3" />
                        <p className="text-slate-500 font-medium">No lab orders found</p>
                        <p className="text-slate-400 text-sm mt-1">
                            {search ? "Try a different search term" : "Create your first lab order to get started"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((order) => (
                            <LabOrderCard key={order.id} order={order} onStatusUpdate={() => refetch()} />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <NewLabOrderModal
                    onClose={() => setShowModal(false)}
                    onCreated={() => {
                        queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
                    }}
                />
            )}
        </DashboardLayout>
    );
}
