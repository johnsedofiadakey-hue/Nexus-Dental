"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Shield, CheckCircle2, XCircle, Clock, AlertCircle, Loader2,
    ChevronDown, ChevronUp, Search, FileText, DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InvoiceWithClaim {
    id: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    paidAt?: string;
    insuranceClaim: boolean;
    insuranceProvider?: string;
    insurancePolicyNo?: string;
    insuranceClaimRef?: string;
    insuranceClaimAmount?: number;
    insuranceClaimStatus?: string;
    insuranceClaimNotes?: string;
    insuranceClaimDate?: string;
    patient: { id: string; firstName: string; lastName: string; phone: string };
    appointment: { id: string; dateTime: string; services?: { name: string }[] | null };
}

type ClaimStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PARTIAL";

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; icon: React.ElementType }> = {
    PENDING:   { label: "Pending",   color: "bg-amber-100 text-amber-700",   icon: Clock },
    SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700",     icon: FileText },
    APPROVED:  { label: "Approved",  color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    REJECTED:  { label: "Rejected",  color: "bg-red-100 text-red-700",       icon: XCircle },
    PARTIAL:   { label: "Partial",   color: "bg-purple-100 text-purple-700", icon: AlertCircle },
};

function ClaimStatusBadge({ status }: { status?: string }) {
    if (!status) return <span className="text-slate-400 text-xs">—</span>;
    const cfg = STATUS_CONFIG[status as ClaimStatus];
    if (!cfg) return <Badge variant="outline">{status}</Badge>;
    const Icon = cfg.icon;
    return (
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
            <Icon className="w-3 h-3" /> {cfg.label}
        </span>
    );
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(n: number) {
    return `GHS ${n.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

interface ClaimEditFormProps {
    invoice: InvoiceWithClaim;
    onClose: () => void;
    onSave: (id: string, data: Partial<InvoiceWithClaim>) => void;
    isSaving: boolean;
}

function ClaimEditForm({ invoice, onClose, onSave, isSaving }: ClaimEditFormProps) {
    const [form, setForm] = useState({
        insuranceClaim: invoice.insuranceClaim,
        insuranceProvider: invoice.insuranceProvider || "",
        insurancePolicyNo: invoice.insurancePolicyNo || "",
        insuranceClaimRef: invoice.insuranceClaimRef || "",
        insuranceClaimAmount: invoice.insuranceClaimAmount?.toString() || "",
        insuranceClaimStatus: invoice.insuranceClaimStatus || "PENDING",
        insuranceClaimNotes: invoice.insuranceClaimNotes || "",
    });

    const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className="border-t border-slate-100 mt-4 pt-4 space-y-4">
            <div className="flex items-center gap-3">
                <input type="checkbox" id={`claim-${invoice.id}`} checked={form.insuranceClaim}
                    onChange={e => set("insuranceClaim", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600" />
                <label htmlFor={`claim-${invoice.id}`} className="text-sm font-medium text-slate-700">
                    This invoice has an insurance claim
                </label>
            </div>

            {form.insuranceClaim && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Insurance Provider</label>
                        <Input placeholder="e.g. NHIS, Enterprise Group" value={form.insuranceProvider}
                            onChange={e => set("insuranceProvider", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Policy Number</label>
                        <Input placeholder="Policy / Member ID" value={form.insurancePolicyNo}
                            onChange={e => set("insurancePolicyNo", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Claim Reference No.</label>
                        <Input placeholder="Claim ref (optional)" value={form.insuranceClaimRef}
                            onChange={e => set("insuranceClaimRef", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Claim Amount (GHS)</label>
                        <Input type="number" min="0" step="0.01" placeholder="Amount being claimed"
                            value={form.insuranceClaimAmount}
                            onChange={e => set("insuranceClaimAmount", e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Claim Status</label>
                        <select value={form.insuranceClaimStatus} onChange={e => set("insuranceClaimStatus", e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="PENDING">Pending</option>
                            <option value="SUBMITTED">Submitted</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="PARTIAL">Partial Approval</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                        <textarea rows={2} placeholder="Any notes about this claim..."
                            value={form.insuranceClaimNotes} onChange={e => set("insuranceClaimNotes", e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
                    </div>
                </div>
            )}

            <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={isSaving}
                    onClick={() => onSave(invoice.id, { ...form, insuranceClaimAmount: form.insuranceClaimAmount ? parseFloat(form.insuranceClaimAmount) : undefined })}>
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Save Claim
                </Button>
            </div>
        </div>
    );
}

const FILTER_TABS = [
    { key: "ALL",       label: "All Claims" },
    { key: "PENDING",   label: "Pending" },
    { key: "SUBMITTED", label: "Submitted" },
    { key: "APPROVED",  label: "Approved" },
    { key: "REJECTED",  label: "Rejected" },
];

export default function InsurancePage() {
    const { data: user } = useCurrentUser();
    const qc = useQueryClient();
    const [filter, setFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["insurance-claims"],
        queryFn: async () => {
            const res = await fetch(`/api/invoices?limit=100`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            return json.data.invoices as InvoiceWithClaim[];
        },
        enabled: !!user,
    });

    const claimMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
            const res = await fetch(`/api/invoices/${id}/claim`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["insurance-claims"] });
            setEditingId(null);
            toast.success("Claim updated");
        },
        onError: () => toast.error("Failed to update claim"),
    });

    const allInvoices = data || [];

    // All invoices with insurance flag, or those with claim data
    const claimInvoices = allInvoices.filter(inv =>
        inv.insuranceClaim ||
        inv.insuranceProvider ||
        inv.insuranceClaimStatus
    );

    const filtered = claimInvoices.filter(inv => {
        const matchFilter = filter === "ALL" || inv.insuranceClaimStatus === filter;
        const matchSearch = !search || [
            inv.patient.firstName, inv.patient.lastName,
            inv.insuranceProvider, inv.insurancePolicyNo, inv.insuranceClaimRef
        ].some(s => s?.toLowerCase().includes(search.toLowerCase()));
        return matchFilter && matchSearch;
    });

    // Summary stats
    const totalClaimed = claimInvoices.reduce((s, i) => s + (i.insuranceClaimAmount || 0), 0);
    const approved = claimInvoices.filter(i => i.insuranceClaimStatus === "APPROVED").length;
    const pending = claimInvoices.filter(i => !i.insuranceClaimStatus || i.insuranceClaimStatus === "PENDING").length;
    const submitted = claimInvoices.filter(i => i.insuranceClaimStatus === "SUBMITTED").length;

    return (
        <DashboardLayout title="Insurance Claims">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Insurance Claims</h2>
                <p className="text-slate-500 mt-1">Track NHIS, corporate, and private insurance claims per invoice.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Total Claimed</p>
                            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalClaimed)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-amber-100 bg-amber-50">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-amber-700">Pending</p>
                            <p className="text-lg font-bold text-amber-800">{pending}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-blue-100 bg-blue-50">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-blue-700">Submitted</p>
                            <p className="text-lg font-bold text-blue-800">{submitted}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-emerald-100 bg-emerald-50">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-700">Approved</p>
                            <p className="text-lg font-bold text-emerald-800">{approved}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {FILTER_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setFilter(tab.key)}
                            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                filter === tab.key ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="relative md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search patient, provider..." className="pl-9"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {/* Notice: link any invoice */}
            <div className="mb-4 p-4 rounded-xl bg-teal-50 border border-teal-100 text-sm text-teal-700">
                <strong>Tip:</strong> Open the <a href="/finance/invoices" className="underline font-medium">Invoices page</a> and click "Add Claim" on any invoice to start tracking insurance for it here.
            </div>

            {isLoading && (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
            )}

            {!isLoading && filtered.length === 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-16 text-center">
                        <Shield className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                        <p className="text-slate-500">No insurance claims found.</p>
                        <p className="text-sm text-slate-400 mt-1">Claims appear here once added to an invoice.</p>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-3">
                {filtered.map(invoice => {
                    const isExpanded = expandedId === invoice.id;
                    const isEditing = editingId === invoice.id;
                    const patientName = `${invoice.patient.firstName} ${invoice.patient.lastName}`;

                    return (
                        <Card key={invoice.id} className="border-none shadow-sm ring-1 ring-slate-100">
                            <CardContent className="p-5">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 text-sm shrink-0">
                                            {invoice.patient.firstName[0]}{invoice.patient.lastName[0]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{patientName}</p>
                                            <p className="text-xs text-slate-400">
                                                {invoice.appointment?.services?.[0]?.name || "Appointment"} · {formatDate(invoice.createdAt)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {invoice.insuranceProvider && (
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                        {invoice.insuranceProvider}
                                                    </span>
                                                )}
                                                {invoice.insurancePolicyNo && (
                                                    <span className="text-xs text-slate-400">#{invoice.insurancePolicyNo}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-slate-400">Invoice Total</p>
                                            <p className="font-bold text-slate-900">{formatCurrency(invoice.totalAmount)}</p>
                                            {invoice.insuranceClaimAmount && (
                                                <p className="text-xs text-teal-600">Claimed: {formatCurrency(invoice.insuranceClaimAmount)}</p>
                                            )}
                                        </div>
                                        <ClaimStatusBadge status={invoice.insuranceClaimStatus} />
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="outline"
                                                onClick={() => { setEditingId(isEditing ? null : invoice.id); setExpandedId(invoice.id); }}>
                                                {isEditing ? "Cancel" : "Edit"}
                                            </Button>
                                            <button onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && !isEditing && (
                                    <div className="border-t border-slate-100 mt-4 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-slate-400 mb-0.5">Provider</p>
                                            <p className="font-medium">{invoice.insuranceProvider || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 mb-0.5">Policy No.</p>
                                            <p className="font-medium">{invoice.insurancePolicyNo || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 mb-0.5">Claim Ref.</p>
                                            <p className="font-medium">{invoice.insuranceClaimRef || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 mb-0.5">Submitted</p>
                                            <p className="font-medium">{invoice.insuranceClaimDate ? formatDate(invoice.insuranceClaimDate) : "—"}</p>
                                        </div>
                                        {invoice.insuranceClaimNotes && (
                                            <div className="col-span-2 md:col-span-4">
                                                <p className="text-xs text-slate-400 mb-0.5">Notes</p>
                                                <p className="text-slate-600">{invoice.insuranceClaimNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isEditing && (
                                    <ClaimEditForm
                                        invoice={invoice}
                                        onClose={() => setEditingId(null)}
                                        onSave={(id, formData) => claimMutation.mutate({ id, data: formData as Record<string, unknown> })}
                                        isSaving={claimMutation.isPending}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </DashboardLayout>
    );
}
