"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Search, X, ChevronDown, CheckCircle2, Clock, AlertCircle,
    XCircle, ClipboardList, ChevronRight, Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

type PlanStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "ON_HOLD";
type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
}

interface TreatmentStep {
    id: string;
    stepNumber: number;
    title: string;
    description: string | null;
    status: StepStatus;
    estimatedCost: number | null;
    completedAt: string | null;
    notes: string | null;
    appointmentId: string | null;
    createdAt: string;
}

interface TreatmentPlanSummary {
    id: string;
    title: string;
    description: string | null;
    status: PlanStatus;
    totalCost: number | null;
    startDate: string | null;
    createdAt: string;
    patient: Patient;
    steps: { total: number; completed: number };
}

interface TreatmentPlanDetail {
    id: string;
    title: string;
    description: string | null;
    status: PlanStatus;
    totalCost: number | null;
    startDate: string | null;
    createdAt: string;
    patient: Patient;
    steps: TreatmentStep[];
    doctor: { id: string; firstName: string; lastName: string };
}

const STATUS_CONFIG: Record<PlanStatus, { label: string; className: string; icon: React.ReactNode }> = {
    ACTIVE: {
        label: "Active",
        className: "bg-teal-50 text-teal-700 border-teal-200",
        icon: <Clock className="h-3 w-3" />,
    },
    COMPLETED: {
        label: "Completed",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="h-3 w-3" />,
    },
    CANCELLED: {
        label: "Cancelled",
        className: "bg-red-50 text-red-700 border-red-200",
        icon: <XCircle className="h-3 w-3" />,
    },
    ON_HOLD: {
        label: "On Hold",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <AlertCircle className="h-3 w-3" />,
    },
};

const STEP_STATUS_CONFIG: Record<StepStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-slate-100 text-slate-600" },
    IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-700" },
    COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
    SKIPPED: { label: "Skipped", className: "bg-slate-100 text-slate-400" },
};

const ALL_STATUSES: PlanStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED", "ON_HOLD"];

async function fetchPlans(status: string, search: string): Promise<TreatmentPlanSummary[]> {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (search) params.set("search", search);
    const res = await fetch(`/api/treatment-plans?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch treatment plans");
    const json = await res.json();
    return json.data.plans as TreatmentPlanSummary[];
}

async function fetchPlanDetail(id: string): Promise<TreatmentPlanDetail> {
    const res = await fetch(`/api/treatment-plans/${id}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch plan detail");
    const json = await res.json();
    return json.data.plan as TreatmentPlanDetail;
}

async function searchPatients(search: string): Promise<Patient[]> {
    const params = new URLSearchParams({ search, limit: "10" });
    const res = await fetch(`/api/patients?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to search patients");
    const json = await res.json();
    return json.data.patients as Patient[];
}

async function createPlan(body: {
    patientId: string;
    title: string;
    description: string;
    totalCost: number | null;
}): Promise<void> {
    const res = await fetch("/api/treatment-plans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create plan");
    }
}

async function markStepComplete(planId: string, stepId: string): Promise<void> {
    const res = await fetch(`/api/treatment-plans/${planId}/steps/${stepId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to update step");
    }
}

interface NewPlanModalProps {
    onClose: () => void;
}

function NewPlanModal({ onClose }: NewPlanModalProps) {
    const queryClient = useQueryClient();
    const [patientSearch, setPatientSearch] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [showPatientResults, setShowPatientResults] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [totalCost, setTotalCost] = useState("");

    const { data: patientResults } = useQuery({
        queryKey: ["patient-search-plan", patientSearch],
        queryFn: () => searchPatients(patientSearch),
        enabled: patientSearch.length >= 2,
    });

    const mutation = useMutation({
        mutationFn: createPlan,
        onSuccess: () => {
            toast.success("Treatment plan created");
            queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
            onClose();
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    function handleSave() {
        if (!selectedPatient || !title) {
            toast.error("Patient and title are required");
            return;
        }
        mutation.mutate({
            patientId: selectedPatient.id,
            title,
            description,
            totalCost: totalCost ? parseFloat(totalCost) : null,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 w-full max-w-lg mx-4 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">New Treatment Plan</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Patient</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search patient..."
                                value={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : patientSearch}
                                onChange={(e) => {
                                    setPatientSearch(e.target.value);
                                    setSelectedPatient(null);
                                    setShowPatientResults(true);
                                }}
                                onFocus={() => setShowPatientResults(true)}
                                className="pl-9 rounded-xl border-slate-200"
                            />
                            {showPatientResults && patientResults && patientResults.length > 0 && !selectedPatient && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg ring-1 ring-slate-100 z-20 max-h-48 overflow-y-auto">
                                    {patientResults.map((p) => (
                                        <button
                                            key={p.id}
                                            className="w-full text-left px-4 py-2.5 hover:bg-teal-50 text-sm text-slate-900 border-b border-slate-50 last:border-0 transition-colors"
                                            onClick={() => {
                                                setSelectedPatient(p);
                                                setShowPatientResults(false);
                                            }}
                                        >
                                            {p.firstName} {p.lastName}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                        <Input
                            placeholder="e.g. Full Mouth Rehabilitation"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="rounded-xl border-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                        <textarea
                            placeholder="Treatment plan overview..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Estimated Cost (optional)</label>
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={totalCost}
                            onChange={(e) => setTotalCost(e.target.value)}
                            className="rounded-xl border-slate-200"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={handleSave}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Creating..." : "Create Plan"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface PlanDetailPanelProps {
    planId: string;
    onClose: () => void;
}

function PlanDetailPanel({ planId, onClose }: PlanDetailPanelProps) {
    const queryClient = useQueryClient();

    const { data: plan, isLoading } = useQuery({
        queryKey: ["treatment-plan-detail", planId],
        queryFn: () => fetchPlanDetail(planId),
    });

    const stepMutation = useMutation({
        mutationFn: ({ stepId }: { stepId: string }) => markStepComplete(planId, stepId),
        onSuccess: () => {
            toast.success("Step marked as completed");
            queryClient.invalidateQueries({ queryKey: ["treatment-plan-detail", planId] });
            queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const steps = Array.isArray(plan?.steps) ? plan.steps as TreatmentStep[] : [];

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">{plan?.title ?? "Loading..."}</h2>
                        {plan && (
                            <p className="text-sm text-slate-500 mt-0.5">
                                {plan.patient.firstName} {plan.patient.lastName}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                        </div>
                    ) : plan ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Status</p>
                                    <div className="mt-1">
                                        <Badge className={`text-xs ${STATUS_CONFIG[plan.status].className}`}>
                                            {STATUS_CONFIG[plan.status].label}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Total Cost</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-1">
                                        {plan.totalCost ? `$${Number(plan.totalCost).toLocaleString()}` : "—"}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Start Date</p>
                                    <p className="text-sm font-medium text-slate-700 mt-1">
                                        {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : "—"}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <p className="text-xs text-slate-500">Created</p>
                                    <p className="text-sm font-medium text-slate-700 mt-1">
                                        {new Date(plan.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {plan.description && (
                                <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
                                    <p className="text-sm text-slate-700">{plan.description}</p>
                                </div>
                            )}

                            <div>
                                <p className="text-sm font-semibold text-slate-900 mb-3">
                                    Treatment Steps ({steps.filter((s) => s.status === "COMPLETED").length}/{steps.length})
                                </p>
                                <div className="space-y-2">
                                    {steps.map((step) => (
                                        <div
                                            key={step.id}
                                            className="rounded-xl border border-slate-100 p-4 space-y-2"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                                                        {step.stepNumber}
                                                    </span>
                                                    <span className="text-sm font-medium text-slate-900">{step.title}</span>
                                                </div>
                                                <Badge className={`text-xs flex-shrink-0 ${STEP_STATUS_CONFIG[step.status].className}`}>
                                                    {STEP_STATUS_CONFIG[step.status].label}
                                                </Badge>
                                            </div>
                                            {step.description && (
                                                <p className="text-xs text-slate-500 pl-7">{step.description}</p>
                                            )}
                                            <div className="flex items-center justify-between pl-7">
                                                <span className="text-xs text-slate-400">
                                                    {step.estimatedCost ? `$${Number(step.estimatedCost).toLocaleString()}` : "No cost set"}
                                                </span>
                                                {step.completedAt && (
                                                    <span className="text-xs text-slate-400">
                                                        Completed {new Date(step.completedAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            {(step.status === "IN_PROGRESS" || step.status === "PENDING") && (
                                                <div className="pl-7">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
                                                        onClick={() => stepMutation.mutate({ stepId: step.id })}
                                                        disabled={stepMutation.isPending}
                                                    >
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Mark Complete
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

interface PlanCardProps {
    plan: TreatmentPlanSummary;
    onClick: () => void;
}

function PlanCard({ plan, onClick }: PlanCardProps) {
    const stepsData = plan.steps as { total: number; completed: number };
    const total = stepsData.total ?? 0;
    const completed = stepsData.completed ?? 0;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const statusCfg = STATUS_CONFIG[plan.status];

    return (
        <Card
            className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl cursor-pointer hover:shadow-md hover:ring-teal-200 transition-all"
            onClick={onClick}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{plan.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {plan.patient.firstName} {plan.patient.lastName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-xs flex items-center gap-1 ${statusCfg.className}`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                </div>

                <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{completed}/{total} steps completed</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                        {plan.totalCost ? `Est. $${Number(plan.totalCost).toLocaleString()}` : "No cost set"}
                    </span>
                    <span>{new Date(plan.createdAt).toLocaleDateString()}</span>
                </div>
            </CardContent>
        </Card>
    );
}

export default function TreatmentPlansPage() {
    const [filterStatus, setFilterStatus] = useState<"ALL" | PlanStatus>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    const { data: plans, isLoading } = useQuery({
        queryKey: ["treatment-plans", filterStatus, searchQuery],
        queryFn: () => fetchPlans(filterStatus, searchQuery),
    });

    const allPlans = plans ?? [];

    const stats = {
        total: allPlans.length,
        active: allPlans.filter((p) => p.status === "ACTIVE").length,
        completed: allPlans.filter((p) => p.status === "COMPLETED").length,
        onHold: allPlans.filter((p) => p.status === "ON_HOLD").length,
    };

    return (
        <DashboardLayout title="Treatment Plans">
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Treatment Plans</h1>
                        <p className="text-sm text-slate-500 mt-1">Manage multi-visit dental treatment plans</p>
                    </div>
                    <Button
                        className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
                        onClick={() => setShowNewModal(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Plan
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                        { label: "Total Plans", value: stats.total, color: "text-slate-900" },
                        { label: "Active", value: stats.active, color: "text-teal-700" },
                        { label: "Completed", value: stats.completed, color: "text-emerald-700" },
                        { label: "On Hold", value: stats.onHold, color: "text-amber-700" },
                    ].map((stat) => (
                        <Card key={stat.label} className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl">
                            <CardContent className="p-5">
                                <p className="text-xs text-slate-500">{stat.label}</p>
                                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl">
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex gap-1 overflow-x-auto">
                                <button
                                    onClick={() => setFilterStatus("ALL")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                        filterStatus === "ALL"
                                            ? "bg-teal-600 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    All
                                </button>
                                {ALL_STATUSES.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setFilterStatus(s)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                            filterStatus === s
                                                ? "bg-teal-600 text-white"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                    >
                                        {STATUS_CONFIG[s].label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative flex-1 max-w-sm ml-auto">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search by patient name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 rounded-xl border-slate-200 h-8 text-sm"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                    </div>
                ) : allPlans.length === 0 ? (
                    <Card className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl">
                        <CardContent className="py-20 text-center">
                            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ClipboardList className="h-8 w-8 text-teal-600" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1">No treatment plans found</h3>
                            <p className="text-sm text-slate-500 mb-4">
                                {filterStatus !== "ALL" || searchQuery
                                    ? "Try adjusting your filters."
                                    : "Create your first treatment plan to get started."}
                            </p>
                            <Button
                                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
                                onClick={() => setShowNewModal(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Plan
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {allPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                onClick={() => setSelectedPlanId(plan.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showNewModal && <NewPlanModal onClose={() => setShowNewModal(false)} />}
            {selectedPlanId && (
                <PlanDetailPanel planId={selectedPlanId} onClose={() => setSelectedPlanId(null)} />
            )}
        </DashboardLayout>
    );
}
