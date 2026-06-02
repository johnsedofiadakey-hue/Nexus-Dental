"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Package, Plus, Search, AlertCircle, ShieldCheck, Truck, Loader2,
    ChevronLeft, ChevronRight, TrendingDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { toast } from "sonner";

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    reorderLevel: number;
    unitCost: number;
    expiryDate?: string;
}

async function fetchInventory(search: string, page: number) {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/clinical/inventory?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch inventory");
    const json = await res.json();
    return json.data as { items: InventoryItem[]; pagination: { total: number; totalPages: number; page: number } };
}

export default function InventoryPage() {
    const { data: user } = useCurrentUser();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search, 350);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["inventory", debouncedSearch, page],
        queryFn: () => fetchInventory(debouncedSearch, page),
        enabled: !!user,
    });

    const items = data?.items ?? [];
    const pagination = data?.pagination;

    const lowStockCount = items.filter(i => i.quantity <= i.reorderLevel).length;
    const inStockCount = items.filter(i => i.quantity > i.reorderLevel).length;
    const totalValuation = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    const healthPct = items.length > 0 ? Math.round((inStockCount / items.length) * 100) : 100;

    return (
        <DashboardLayout title="Inventory & Pharmacy">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Stock Control</h2>
                    <p className="text-slate-500">Monitor supplies, manage medications, and track orders.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Truck className="w-4 h-4" /> Suppliers
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                        <Plus className="w-4 h-4" /> Add Item
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className={`border-none shadow-sm ${lowStockCount > 0 ? "ring-1 ring-red-100 bg-red-50" : "ring-1 ring-slate-100"}`}>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${lowStockCount > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                            <AlertCircle className={`w-6 h-6 ${lowStockCount > 0 ? "text-red-600" : "text-slate-400"}`} />
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${lowStockCount > 0 ? "text-red-900" : "text-slate-700"}`}>Low Stock Alert</p>
                            <p className={`text-xs ${lowStockCount > 0 ? "text-red-700" : "text-slate-400"}`}>
                                {isLoading ? "Loading..." : `${lowStockCount} item${lowStockCount !== 1 ? "s" : ""} below reorder point`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50 border-none shadow-sm ring-1 ring-emerald-100">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-900">Inventory Health</p>
                            <p className="text-xs text-emerald-700">
                                {isLoading ? "Loading..." : `${healthPct}% of items in stock`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-none shadow-sm ring-1 ring-blue-100">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Package className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-blue-900">Total Valuation</p>
                            <p className="text-xs text-blue-700">
                                {isLoading ? "Loading..." : `GH₵ ${totalValuation.toLocaleString()} across all stock`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Current Stock</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search items..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="pl-9 h-10 rounded-xl"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-7 h-7 text-teal-600 animate-spin" />
                        </div>
                    )}
                    {isError && (
                        <div className="p-6 text-center text-red-600 text-sm">
                            Failed to load inventory. <button className="underline" onClick={() => refetch()}>Retry</button>
                        </div>
                    )}
                    {!isLoading && !isError && items.length === 0 && (
                        <div className="p-12 text-center text-slate-400">
                            <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p>No inventory items found.</p>
                        </div>
                    )}
                    {!isLoading && items.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Item Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Quantity</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Unit Cost</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item) => {
                                        const isLow = item.quantity <= item.reorderLevel;
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-semibold text-slate-900">{item.name}</p>
                                                    {item.expiryDate && (
                                                        <p className="text-xs text-slate-400">Exp: {new Date(item.expiryDate).toLocaleDateString("en-GB")}</p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500">{item.category}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-900">{item.quantity} {item.unit}</span>
                                                        {isLow && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                                                    </div>
                                                    <p className="text-xs text-slate-400">Reorder at {item.reorderLevel}</p>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-700">
                                                    GH₵ {item.unitCost.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge className={`border-none font-bold ${isLow ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                                                        {isLow ? "Low Stock" : "In Stock"}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button variant="ghost" size="sm" className="text-teal-600 hover:bg-teal-50">Adjust</Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                        <p className="text-sm text-slate-500">{pagination.total} items total</p>
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
        </DashboardLayout>
    );
}
