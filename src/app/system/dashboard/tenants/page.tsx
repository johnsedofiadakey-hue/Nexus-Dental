"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Building2, Plus, Search, MoreVertical, Activity,
    ShieldAlert, Power, PauseCircle, CheckCircle,
    Loader2, Users, Calendar, LifeBuoy, TrendingUp
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED" | "FROZEN" | "MAINTENANCE";
    createdAt: string;
    _count?: {
        users: number;
        patients: number;
        appointments: number;
    }
}

interface TenantStats {
    users: number;
    patients: number;
    appointments: { total: number; active: number };
    support: { total: number; open: number };
    inventory: { total: number; lowStock: number };
    revenue: number;
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
    const [stats, setStats] = useState<TenantStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            const res = await fetch("/api/system/tenants");
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setTenants(data.data.tenants || []);
                }
            }
        } catch (error) {
            toast.error("Failed to fetch clinics");
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async (id: string) => {
        setStatsLoading(true);
        try {
            const res = await fetch(`/api/system/tenants/${id}`);
            const data = await res.json();
            if (data.success) {
                setStats(data.data.stats);
            }
        } catch (error) {
            toast.error("Failed to fetch occupancy stats");
        } finally {
            setStatsLoading(false);
        }
    };

    const handleStatusChange = async (id: string, action: string, reason: string = "Standard administrative action") => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/system/tenants/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Clinic ${action.replace("_", " ")} successfully`);
                fetchTenants();
                if (selectedTenant?.id === id) {
                    setSelectedTenant({ ...selectedTenant, status: data.data.status });
                }
            } else {
                toast.error(data.error || "Action failed");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setActionLoading(false);
        }
    };

    const filteredTenants = tenants.filter((tenant) =>
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
            case "SUSPENDED": return "bg-rose-100 text-rose-700 border-rose-200";
            case "FROZEN": return "bg-blue-100 text-blue-700 border-blue-200";
            case "MAINTENANCE": return "bg-amber-100 text-amber-700 border-amber-200";
            default: return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="Tenant Control Center"
            userName="Super Admin"
            userRoleLabel="System Owner"
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold">Clinic Real Estate</h2>
                        <p className="text-muted-foreground">Global control for all dental clinic instances</p>
                    </div>
                    <Button className="gap-2 bg-teal-600 hover:bg-teal-700">
                        <Plus className="w-4 h-4" />
                        Onboard New Clinic
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by clinic name, domain slug, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 rounded-xl" />
                        ))}
                    </div>
                ) : filteredTenants.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardContent className="py-20 text-center">
                            <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">No active clinics found</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                {searchQuery ? "No results match your search criteria. Try a different term." : "Your platform is currently empty. Get started by onboarding your first dental clinic tenant."}
                            </p>
                            {!searchQuery && (
                                <Button className="gap-2 bg-teal-600">
                                    <Plus className="w-4 h-4" />
                                    Create First Tenant
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredTenants.map((tenant) => (
                            <Card
                                key={tenant.id}
                                className="group hover:border-teal-200 transition-all cursor-pointer shadow-sm hover:shadow-md"
                                onClick={() => {
                                    setSelectedTenant(tenant);
                                    fetchStats(tenant.id);
                                }}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className={cn(
                                                "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
                                                tenant.status === "ACTIVE" ? "bg-teal-50 text-teal-600" : "bg-slate-50 text-slate-400"
                                            )}>
                                                <Building2 className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-xl text-slate-900">{tenant.name}</h3>
                                                    <Badge className={cn("ml-2", getStatusColor(tenant.status))}>
                                                        {tenant.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3.5 h-3.5" />
                                                        {tenant.slug}.nexusdental.com
                                                    </span>
                                                    <span>•</span>
                                                    <span>Joined {new Date(tenant.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="hidden lg:flex gap-10 text-center">
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff</p>
                                                    <p className="text-lg font-bold text-slate-700">{tenant._count?.users || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Patients</p>
                                                    <p className="text-lg font-bold text-slate-700">{tenant._count?.patients || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bookings</p>
                                                    <p className="text-lg font-bold text-slate-700">{tenant._count?.appointments || 0}</p>
                                                </div>
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="group-hover:bg-slate-100">
                                                        <MoreVertical className="w-5 h-5 text-slate-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); fetchStats(tenant.id); }}>
                                                        <Activity className="w-4 h-4 mr-2" /> View Operations
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {tenant.status === "ACTIVE" ? (
                                                        <DropdownMenuItem
                                                            className="text-amber-600"
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(tenant.id, "kill_switch", "Admin override"); }}
                                                        >
                                                            <PauseCircle className="w-4 h-4 mr-2" /> Suspend Clinic
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem
                                                            className="text-emerald-600"
                                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(tenant.id, "change_status", "Re-activation", "ACTIVE"); }}
                                                        >
                                                            <CheckCircle className="w-4 h-4 mr-2" /> Activate Clinic
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="text-rose-600 focus:bg-rose-50"
                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(tenant.id, "kill_switch", "Emergency shutdown"); }}
                                                    >
                                                        <Power className="w-4 h-4 mr-2" /> Kill Switch
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Tenant Detail Modal */}
            <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold">{selectedTenant?.name}</DialogTitle>
                                <DialogDescription>Clinic ID: {selectedTenant?.id}</DialogDescription>
                            </div>
                            <Badge className={cn("ml-auto", selectedTenant && getStatusColor(selectedTenant.status))}>
                                {selectedTenant?.status}
                            </Badge>
                        </div>
                    </DialogHeader>

                    {statsLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                            <p className="text-sm text-muted-foreground font-medium animate-pulse">Calculating real-time occupancy...</p>
                        </div>
                    ) : stats ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                            <Card className="bg-slate-50/50 border-none shadow-none">
                                <CardContent className="p-4 flex flex-col items-center">
                                    <Users className="w-8 h-8 text-teal-600 mb-2" />
                                    <p className="text-sm text-muted-foreground font-semibold uppercase tracking-tighter">Total Patients</p>
                                    <h4 className="text-2xl font-black text-slate-900">{stats.patients}</h4>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-50/50 border-none shadow-none">
                                <CardContent className="p-4 flex flex-col items-center">
                                    <Calendar className="w-8 h-8 text-orange-500 mb-2" />
                                    <p className="text-sm text-muted-foreground font-semibold uppercase tracking-tighter">Active Bookings</p>
                                    <h4 className="text-2xl font-black text-slate-900">{stats.appointments.active}</h4>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-50/50 border-none shadow-none">
                                <CardContent className="p-4 flex flex-col items-center">
                                    <TrendingUp className="w-8 h-8 text-indigo-600 mb-2" />
                                    <p className="text-sm text-muted-foreground font-semibold uppercase tracking-tighter">Total Revenue</p>
                                    <h4 className="text-2xl font-black text-slate-900">₵{stats.revenue.toLocaleString()}</h4>
                                </CardContent>
                            </Card>

                            <div className="md:col-span-3 mt-4 space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h5 className="font-bold text-slate-900 flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                                        Advanced Controls
                                    </h5>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-20 flex flex-col gap-1 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 group"
                                        onClick={() => handleStatusChange(selectedTenant!.id, "kill_switch", "Manual administrative override")}
                                        disabled={actionLoading}
                                    >
                                        <Power className="w-5 h-5 group-hover:animate-pulse" />
                                        <span>Full Kill-Switch</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-20 flex flex-col gap-1 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                                        onClick={() => handleStatusChange(selectedTenant!.id, "enable_maintenance", "System scheduled maintenance")}
                                        disabled={actionLoading}
                                    >
                                        <Activity className="w-5 h-5" />
                                        <span>Maintenance Mode</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-muted-foreground">
                            Failed to load statistical data for this tenant.
                        </div>
                    )}

                    <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 border-t px-6">
                        <Button variant="ghost" onClick={() => setSelectedTenant(null)}>Close Overview</Button>
                        <Button variant="secondary" className="bg-slate-200 hover:bg-slate-300">View Audit Logs</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
