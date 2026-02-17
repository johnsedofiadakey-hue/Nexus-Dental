"use client";

import {
    Package,
    Plus,
    Search,
    Filter,
    AlertCircle,
    TrendingDown,
    ShieldCheck,
    Truck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";

export default function InventoryPage() {
    return (
        <DashboardLayout
            role="INVENTORY_MANAGER"
            title="Inventory & Pharmacy"
            userName="Stock Manager"
            userRoleLabel="Logistics"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-900">Stock Control</h2>
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

            {/* Inventory Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-red-50 border-none shadow-sm ring-1 ring-red-100">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-900">Low Stock Alert</p>
                            <p className="text-xs text-red-700">4 items are below reorder point</p>
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
                            <p className="text-xs text-emerald-700">92% of items in stock</p>
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
                            <p className="text-xs text-blue-700">GH₵ 42,300 across all stock</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Inventory Table */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Current Stock</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search items..." className="pl-9 h-10 rounded-xl" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Item Name</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Category</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Quantity</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    { name: "Surgical Masks", cat: "Consumables", qty: "450 units", status: "In Stock" },
                                    { name: "Amoxicillin 500mq", cat: "Pharmacy", qty: "12 units", status: "Low Stock" },
                                    { name: "Dental Resin", cat: "Clinical", qty: "85 units", status: "In Stock" },
                                    { name: "Gloves (Large)", cat: "Consumables", qty: "1,200 units", status: "In Stock" },
                                ].map((item, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-slate-900">{item.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{item.cat}</td>
                                        <td className="px-6 py-4 text-sm text-slate-900 font-bold">{item.qty}</td>
                                        <td className="px-6 py-4">
                                            <Badge className={item.status === "Low Stock" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}>
                                                {item.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" size="sm" className="text-teal-600">Adjust</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
