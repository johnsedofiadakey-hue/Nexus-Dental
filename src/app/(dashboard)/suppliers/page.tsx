"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Building2, Plus, Phone, Mail, Clock, CheckCircle, XCircle,
    ShoppingCart, Loader2, ChevronDown, Trash2, Pencil, X, Package
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
    id: string;
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    category: string | null;
    paymentTerms: string | null;
    leadTimeDays: number | null;
    isActive: boolean;
    notes: string | null;
}

interface POItem {
    name: string;
    qty: number;
    unitPrice: number;
    unit: string;
}

type POStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

interface PurchaseOrder {
    id: string;
    orderNo: string;
    status: POStatus;
    totalAmount: number;
    notes: string | null;
    expectedAt: string | null;
    receivedAt: string | null;
    createdAt: string;
    items: POItem[];
    supplier: { id: string; name: string };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<POStatus, string> = {
    DRAFT: "Draft",
    ORDERED: "Ordered",
    PARTIALLY_RECEIVED: "In Transit",
    RECEIVED: "Received",
    CANCELLED: "Cancelled",
};

const STATUS_CLASSES: Record<POStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    ORDERED: "bg-blue-100 text-blue-700",
    PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
    RECEIVED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, { credentials: "include", ...init });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json.data;
}

// ─── Supplier Modal ───────────────────────────────────────────────────────────

interface SupplierModalProps {
    tenantId: string;
    existing?: Supplier;
    onClose: () => void;
    onSaved: () => void;
}

function SupplierModal({ tenantId, existing, onClose, onSaved }: SupplierModalProps) {
    const [form, setForm] = useState({
        name: existing?.name ?? "",
        contactPerson: existing?.contactPerson ?? "",
        email: existing?.email ?? "",
        phone: existing?.phone ?? "",
        address: existing?.address ?? "",
        category: existing?.category ?? "",
        paymentTerms: existing?.paymentTerms ?? "",
        leadTimeDays: existing?.leadTimeDays?.toString() ?? "",
        notes: existing?.notes ?? "",
    });
    const [loading, setLoading] = useState(false);

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("Name is required");
        setLoading(true);
        try {
            const body = {
                tenantId,
                name: form.name.trim(),
                contactPerson: form.contactPerson || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                address: form.address || undefined,
                category: form.category || undefined,
                paymentTerms: form.paymentTerms || undefined,
                leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : undefined,
                notes: form.notes || undefined,
            };
            if (existing) {
                await apiFetch(`/api/suppliers/${existing.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                toast.success("Supplier updated");
            } else {
                await apiFetch("/api/suppliers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                toast.success("Supplier created");
            }
            onSaved();
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save supplier");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">{existing ? "Edit Supplier" : "Add Supplier"}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                            <Input value={form.name} onChange={set("name")} placeholder="Supplier name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                            <Input value={form.contactPerson} onChange={set("contactPerson")} placeholder="Contact name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <Input value={form.category} onChange={set("category")} placeholder="e.g. Consumables" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <Input type="email" value={form.email} onChange={set("email")} placeholder="email@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                            <Input value={form.phone} onChange={set("phone")} placeholder="+233..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                            <Input value={form.paymentTerms} onChange={set("paymentTerms")} placeholder="e.g. Net 30" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Time (days)</label>
                            <Input type="number" value={form.leadTimeDays} onChange={set("leadTimeDays")} placeholder="7" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <Input value={form.address} onChange={set("address")} placeholder="Full address" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={set("notes")}
                                rows={2}
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Additional notes..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {existing ? "Save Changes" : "Create Supplier"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── PO Modal ─────────────────────────────────────────────────────────────────

interface POModalProps {
    tenantId: string;
    suppliers: Supplier[];
    onClose: () => void;
    onSaved: () => void;
}

const emptyItem = (): POItem => ({ name: "", qty: 1, unitPrice: 0, unit: "units" });

function POModal({ tenantId, suppliers, onClose, onSaved }: POModalProps) {
    const [supplierId, setSupplierId] = useState("");
    const [notes, setNotes] = useState("");
    const [expectedAt, setExpectedAt] = useState("");
    const [items, setItems] = useState<POItem[]>([emptyItem()]);
    const [loading, setLoading] = useState(false);

    const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

    const updateItem = (idx: number, field: keyof POItem, value: string | number) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId) return toast.error("Select a supplier");
        if (items.some(i => !i.name.trim())) return toast.error("All items need a name");
        setLoading(true);
        try {
            await apiFetch("/api/purchase-orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId,
                    supplierId,
                    items,
                    notes: notes || undefined,
                    expectedAt: expectedAt || undefined,
                }),
            });
            toast.success("Purchase order created");
            onSaved();
            onClose();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to create PO");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">New Purchase Order</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
                            <select
                                value={supplierId}
                                onChange={e => setSupplierId(e.target.value)}
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">Select supplier...</option>
                                {suppliers.filter(s => s.isActive).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Date</label>
                            <Input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">Line Items *</label>
                            <Button type="button" size="sm" variant="outline" onClick={() => setItems(p => [...p, emptyItem()])}>
                                <Plus className="w-3 h-3 mr-1" /> Add Item
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-1">
                                <span className="col-span-4">Name</span>
                                <span className="col-span-2">Qty</span>
                                <span className="col-span-2">Unit</span>
                                <span className="col-span-3">Unit Price (GHS)</span>
                                <span className="col-span-1"></span>
                            </div>
                            {items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <Input
                                        className="col-span-4"
                                        value={item.name}
                                        onChange={e => updateItem(idx, "name", e.target.value)}
                                        placeholder="Item name"
                                    />
                                    <Input
                                        className="col-span-2"
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={e => updateItem(idx, "qty", parseInt(e.target.value) || 1)}
                                    />
                                    <Input
                                        className="col-span-2"
                                        value={item.unit}
                                        onChange={e => updateItem(idx, "unit", e.target.value)}
                                        placeholder="units"
                                    />
                                    <Input
                                        className="col-span-3"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unitPrice}
                                        onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                                    />
                                    <button
                                        type="button"
                                        className="col-span-1 text-slate-400 hover:text-red-500 flex items-center justify-center"
                                        onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                                        disabled={items.length === 1}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end mt-3">
                            <span className="text-sm font-semibold text-slate-700">
                                Total: <span className="text-teal-600">GHS {total.toFixed(2)}</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white">
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Purchase Order
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabType = "suppliers" | "purchase-orders";
type POFilterStatus = "ALL" | POStatus;

export default function SuppliersPage() {
    const { data: user } = useCurrentUser();
    const qc = useQueryClient();
    const [tab, setTab] = useState<TabType>("suppliers");
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();
    const [showPOModal, setShowPOModal] = useState(false);
    const [poFilter, setPOFilter] = useState<POFilterStatus>("ALL");

    const tenantId = user?.tenantId ?? "";

    // ── Suppliers ──
    const suppliersQuery = useQuery<Supplier[]>({
        queryKey: ["suppliers", tenantId],
        queryFn: () => apiFetch(`/api/suppliers?tenantId=${tenantId}`),
        enabled: !!tenantId,
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) =>
            apiFetch(`/api/suppliers/${id}?tenantId=${tenantId}`, { method: "DELETE" }),
        onSuccess: () => {
            toast.success("Supplier deactivated");
            qc.invalidateQueries({ queryKey: ["suppliers", tenantId] });
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"),
    });

    // ── Purchase Orders ──
    const posQuery = useQuery<PurchaseOrder[]>({
        queryKey: ["purchase-orders", tenantId],
        queryFn: () => apiFetch(`/api/purchase-orders?tenantId=${tenantId}`),
        enabled: !!tenantId,
    });

    const markReceivedMutation = useMutation({
        mutationFn: (id: string) =>
            apiFetch(`/api/purchase-orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId, status: "RECEIVED" }),
            }),
        onSuccess: () => {
            toast.success("Purchase order marked as received & inventory updated");
            qc.invalidateQueries({ queryKey: ["purchase-orders", tenantId] });
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"),
    });

    const suppliers = suppliersQuery.data ?? [];
    const pos = posQuery.data ?? [];

    // PO stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const draftCount = pos.filter(p => p.status === "DRAFT").length;
    const orderedCount = pos.filter(p => p.status === "ORDERED").length;
    const inTransitCount = pos.filter(p => p.status === "PARTIALLY_RECEIVED").length;
    const receivedThisMonth = pos.filter(
        p => p.status === "RECEIVED" && p.receivedAt && new Date(p.receivedAt) >= startOfMonth
    ).length;

    const filteredPOs = poFilter === "ALL" ? pos : pos.filter(p => p.status === poFilter);

    const poFilterTabs: { key: POFilterStatus; label: string }[] = [
        { key: "ALL", label: "All" },
        { key: "DRAFT", label: "Draft" },
        { key: "ORDERED", label: "Ordered" },
        { key: "RECEIVED", label: "Received" },
    ];

    return (
        <DashboardLayout title="Suppliers & Procurement">
            {/* Tab Bar */}
            <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
                {(["suppliers", "purchase-orders"] as TabType[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            tab === t
                                ? "bg-white text-teal-700 shadow-sm"
                                : "text-slate-600 hover:text-slate-800"
                        }`}
                    >
                        {t === "suppliers" ? "Suppliers" : "Purchase Orders"}
                    </button>
                ))}
            </div>

            {/* ── Suppliers Tab ── */}
            {tab === "suppliers" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Suppliers</h1>
                            <p className="text-slate-500 text-sm mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} registered</p>
                        </div>
                        <Button
                            onClick={() => { setEditingSupplier(undefined); setShowSupplierModal(true); }}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Supplier
                        </Button>
                    </div>

                    {suppliersQuery.isLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                        </div>
                    ) : suppliers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Building2 className="w-12 h-12 mb-3 opacity-40" />
                            <p className="text-lg font-medium">No suppliers yet</p>
                            <p className="text-sm">Add your first supplier to get started</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {suppliers.map(supplier => (
                                <Card key={supplier.id} className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                                                    <Building2 className="w-5 h-5 text-teal-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-semibold text-slate-800">{supplier.name}</h3>
                                                        {supplier.category && (
                                                            <Badge variant="outline" className="text-xs">{supplier.category}</Badge>
                                                        )}
                                                        <Badge className={`text-xs ${supplier.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                                            {supplier.isActive ? (
                                                                <><CheckCircle className="w-3 h-3 mr-1" />Active</>
                                                            ) : (
                                                                <><XCircle className="w-3 h-3 mr-1" />Inactive</>
                                                            )}
                                                        </Badge>
                                                    </div>
                                                    {supplier.contactPerson && (
                                                        <p className="text-sm text-slate-500 mt-0.5">{supplier.contactPerson}</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-4 mt-2">
                                                        {supplier.phone && (
                                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                                <Phone className="w-3 h-3" />{supplier.phone}
                                                            </span>
                                                        )}
                                                        {supplier.email && (
                                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                                <Mail className="w-3 h-3" />{supplier.email}
                                                            </span>
                                                        )}
                                                        {supplier.leadTimeDays != null && (
                                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                                <Clock className="w-3 h-3" />{supplier.leadTimeDays}d lead time
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => { setEditingSupplier(supplier); setShowSupplierModal(true); }}
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                {supplier.isActive && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => {
                                                            if (confirm(`Deactivate ${supplier.name}?`)) {
                                                                deactivateMutation.mutate(supplier.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Purchase Orders Tab ── */}
            {tab === "purchase-orders" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
                            <p className="text-slate-500 text-sm mt-0.5">{pos.length} order{pos.length !== 1 ? "s" : ""} total</p>
                        </div>
                        <Button onClick={() => setShowPOModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                            <Plus className="w-4 h-4 mr-2" /> New Purchase Order
                        </Button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Draft", count: draftCount, color: "text-slate-600", bg: "bg-slate-50" },
                            { label: "Ordered", count: orderedCount, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "In Transit", count: inTransitCount, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Received (this month)", count: receivedThisMonth, color: "text-emerald-600", bg: "bg-emerald-50" },
                        ].map(card => (
                            <Card key={card.label} className="border-none shadow-sm ring-1 ring-slate-100">
                                <CardContent className="p-4">
                                    <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                                    <p className={`text-3xl font-bold ${card.color}`}>{card.count}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                        {poFilterTabs.map(ft => (
                            <button
                                key={ft.key}
                                onClick={() => setPOFilter(ft.key)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    poFilter === ft.key
                                        ? "bg-white text-teal-700 shadow-sm"
                                        : "text-slate-600 hover:text-slate-800"
                                }`}
                            >
                                {ft.label}
                            </button>
                        ))}
                    </div>

                    {/* PO List */}
                    {posQuery.isLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                        </div>
                    ) : filteredPOs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <ShoppingCart className="w-12 h-12 mb-3 opacity-40" />
                            <p className="text-lg font-medium">No purchase orders</p>
                            <p className="text-sm">Create your first purchase order above</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredPOs.map(po => (
                                <Card key={po.id} className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-800 font-mono text-sm">{po.orderNo}</span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[po.status]}`}>
                                                            {STATUS_LABELS[po.status]}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-0.5">{po.supplier.name}</p>
                                                    <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                                                        <span>{(po.items as POItem[]).length} item{(po.items as POItem[]).length !== 1 ? "s" : ""}</span>
                                                        {po.expectedAt && (
                                                            <span>Expected: {new Date(po.expectedAt).toLocaleDateString()}</span>
                                                        )}
                                                        <span>Created: {new Date(po.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-slate-800">GHS {po.totalAmount.toFixed(2)}</p>
                                                </div>
                                                {po.status === "ORDERED" && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                                        onClick={() => {
                                                            if (confirm(`Mark ${po.orderNo} as received? This will update inventory stock.`)) {
                                                                markReceivedMutation.mutate(po.id);
                                                            }
                                                        }}
                                                        disabled={markReceivedMutation.isPending}
                                                    >
                                                        {markReceivedMutation.isPending ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            "Mark Received"
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showSupplierModal && tenantId && (
                <SupplierModal
                    tenantId={tenantId}
                    existing={editingSupplier}
                    onClose={() => { setShowSupplierModal(false); setEditingSupplier(undefined); }}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["suppliers", tenantId] })}
                />
            )}
            {showPOModal && tenantId && (
                <POModal
                    tenantId={tenantId}
                    suppliers={suppliers}
                    onClose={() => setShowPOModal(false)}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["purchase-orders", tenantId] })}
                />
            )}
        </DashboardLayout>
    );
}
