"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FileText, DollarSign, CheckCircle2, Clock, AlertCircle,
    Search, ChevronLeft, ChevronRight, Loader2, CreditCard, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

interface Invoice {
    id: string;
    amount: number;
    discount: number;
    totalAmount: number;
    status: string;
    paidAt?: string;
    createdAt: string;
    notes?: string;
    items: any[];
    patient: { id: string; firstName: string; lastName: string; phone: string };
    createdBy: { firstName: string; lastName: string };
    appointment: { id: string; dateTime: string; services: { name: string }[] };
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    UNPAID:         { label: "Unpaid",         className: "bg-red-50 text-red-700" },
    PAID:           { label: "Paid",           className: "bg-emerald-50 text-emerald-700" },
    CANCELLED:      { label: "Cancelled",      className: "bg-slate-100 text-slate-500" },
    PARTIAL:        { label: "Partial",        className: "bg-amber-50 text-amber-700" },
    REFUNDED:       { label: "Refunded",       className: "bg-purple-50 text-purple-700" },
    PARTIAL_REFUND: { label: "Part. Refunded", className: "bg-purple-50 text-purple-600" },
};

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function initials(f: string, l: string) { return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase(); }

async function fetchInvoices(status: string, page: number) {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`/api/invoices?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch invoices");
    return (await res.json()).data as { invoices: Invoice[]; pagination: any };
}

async function markPaid(invoiceId: string, method: string) {
    const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to mark as paid");
    return res.json();
}

async function initPaystack(invoiceId: string): Promise<string> {
    const res = await fetch(`/api/invoices/${invoiceId}/paystack-init`, {
        method: "POST",
        credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Paystack init failed");
    return json.data.authorizationUrl as string;
}

export default function InvoicesPage() {
    const { data: user } = useCurrentUser();
    const [status, setStatus] = useState("ALL");
    const [page, setPage] = useState(1);
    const qc = useQueryClient();

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["invoices", status, page],
        queryFn: () => fetchInvoices(status, page),
        enabled: !!user,
    });

    const payMutation = useMutation({
        mutationFn: ({ id, method }: { id: string; method: string }) => markPaid(id, method),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice marked as paid"); },
        onError: () => toast.error("Failed to update invoice"),
    });

    const paystackMutation = useMutation({
        mutationFn: (id: string) => initPaystack(id),
        onSuccess: (url) => { window.open(url, "_blank"); },
        onError: (err: Error) => toast.error(err.message || "Could not generate payment link"),
    });

    const invoices = data?.invoices ?? [];
    const pagination = data?.pagination;

    const unpaidTotal = invoices.filter(i => i.status === "UNPAID").reduce((s, i) => s + i.totalAmount, 0);
    const paidTotal   = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + i.totalAmount, 0);

    const tabs = ["ALL", "UNPAID", "PAID", "PARTIAL", "CANCELLED"];

    return (
        <DashboardLayout title="Invoices">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Invoice Management</h2>
                    <p className="text-slate-500">Track payments, outstanding balances, and billing history.</p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-none shadow-sm ring-1 ring-red-100 bg-red-50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-900">Outstanding (shown)</p>
                            <p className="text-2xl font-bold text-red-800">GH₵ {unpaidTotal.toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-emerald-100 bg-emerald-50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-900">Collected (shown)</p>
                            <p className="text-2xl font-bold text-emerald-800">GH₵ {paidTotal.toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Total Invoices</p>
                            <p className="text-2xl font-bold text-slate-900">{pagination?.total ?? 0}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6 flex-wrap">
                {tabs.map(t => (
                    <button key={t} onClick={() => { setStatus(t); setPage(1); }}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${status === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                        {t === "ALL" ? "All" : STATUS_CONFIG[t]?.label ?? t}
                    </button>
                ))}
            </div>

            {isLoading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-teal-600 animate-spin" /></div>}
            {isError && (
                <Card className="border-none shadow-sm ring-1 ring-red-100 bg-red-50">
                    <CardContent className="p-4 text-red-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Failed to load. <button className="underline" onClick={() => refetch()}>Retry</button>
                    </CardContent>
                </Card>
            )}

            {!isLoading && invoices.length === 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-12 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No invoices found.</p>
                    </CardContent>
                </Card>
            )}

            {!isLoading && invoices.length > 0 && (
                <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Patient</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Service</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoices.map(inv => {
                                    const cfg = STATUS_CONFIG[inv.status] ?? { label: inv.status, className: "bg-slate-100 text-slate-600" };
                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 text-xs">
                                                        {initials(inv.patient.firstName, inv.patient.lastName)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{inv.patient.firstName} {inv.patient.lastName}</p>
                                                        <p className="text-xs text-slate-400">{inv.patient.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">
                                                {inv.appointment?.services?.[0]?.name ?? "—"}
                                                {inv.discount > 0 && <p className="text-xs text-slate-400">Discount: GH₵ {inv.discount}</p>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {formatDate(inv.createdAt)}
                                                {inv.paidAt && <p className="text-xs text-emerald-600">Paid {formatDate(inv.paidAt)}</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900">GH₵ {inv.totalAmount.toLocaleString()}</p>
                                                {inv.discount > 0 && <p className="text-xs text-slate-400 line-through">GH₵ {inv.amount.toLocaleString()}</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge className={`${cfg.className} border-none font-bold`}>{cfg.label}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {inv.status === "UNPAID" && (<>
                                                        <Button size="sm" variant="outline"
                                                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                                            onClick={() => payMutation.mutate({ id: inv.id, method: "CASH" })}
                                                            disabled={payMutation.isPending}>
                                                            Cash
                                                        </Button>
                                                        <Button size="sm" variant="outline"
                                                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                                                            onClick={() => payMutation.mutate({ id: inv.id, method: "CARD" })}
                                                            disabled={payMutation.isPending}>
                                                            <CreditCard className="w-3.5 h-3.5 mr-1" /> Card
                                                        </Button>
                                                        <Button size="sm"
                                                            className="bg-teal-600 hover:bg-teal-700"
                                                            onClick={() => paystackMutation.mutate(inv.id)}
                                                            disabled={paystackMutation.isPending}
                                                            title="Generate Paystack online payment link">
                                                            {paystackMutation.isPending
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : "Pay Online"}
                                                        </Button>
                                                    </>)}
                                                    <a href={`/insurance`}
                                                        className="text-xs text-teal-600 hover:underline whitespace-nowrap">
                                                        + Claim
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                            <p className="text-sm text-slate-500">{pagination.total} invoices total</p>
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
