"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search, MoreVertical, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        async function fetchTenants() {
            try {
                const res = await fetch("/api/system/tenants");
                if (res.ok) {
                    const data = await res.json();
                    setTenants(data.tenants || []);
                }
            } catch (error) {
                console.error("Failed to fetch tenants:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchTenants();
    }, []);

    const filteredTenants = tenants.filter((tenant) =>
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="Tenant Management"
            userName="Super Admin"
            userRoleLabel="System Owner"
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold">Clinic Tenants</h2>
                        <p className="text-muted-foreground">Manage all registered dental clinics</p>
                    </div>
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add New Clinic
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search clinics by name or slug..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24" />
                        ))}
                    </div>
                ) : filteredTenants.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">No clinics found</h3>
                            <p className="text-muted-foreground mb-4">
                                {searchQuery ? "Try a different search term" : "Get started by adding your first clinic"}
                            </p>
                            {!searchQuery && (
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Add First Clinic
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredTenants.map((tenant) => (
                            <Card key={tenant.id}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
                                                <Building2 className="w-6 h-6 text-teal-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">{tenant.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Slug: {tenant.slug}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge
                                                variant={tenant.status === "ACTIVE" ? "success" : "secondary"}
                                            >
                                                {tenant.status}
                                            </Badge>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
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
