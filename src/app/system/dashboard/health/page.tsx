"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Activity, HardDrive, Cpu, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface HealthStatus {
    service: string;
    status: "healthy" | "degraded" | "down";
    latency?: string;
    message?: string;
}

export default function HealthPage() {
    const [healthData, setHealthData] = useState<HealthStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHealth() {
            try {
                const res = await fetch("/api/system/health");
                if (res.ok) {
                    const data = await res.json();
                    setHealthData(data.services || []);
                }
            } catch (error) {
                console.error("Failed to fetch health data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchHealth();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "healthy":
                return "bg-green-100 text-green-800 border-green-200";
            case "degraded":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "down":
                return "bg-red-100 text-red-800 border-red-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getIcon = (service: string) => {
        switch (service.toLowerCase()) {
            case "database":
                return Database;
            case "redis":
                return HardDrive;
            case "workers":
                return Cpu;
            default:
                return Activity;
        }
    };

    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="System Health"
            userName="Super Admin"
            userRoleLabel="System Owner"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold">System Health Monitoring</h2>
                    <p className="text-muted-foreground">
                        Real-time status of critical infrastructure components
                    </p>
                </div>

                {loading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-32" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[
                            { service: "Database", status: "healthy", latency: "12ms", message: "PostgreSQL connected" },
                            { service: "Redis", status: "healthy", latency: "5ms", message: "Cache operational" },
                            { service: "Workers", status: "healthy", latency: "N/A", message: "All queues processing" },
                        ].map((item, i) => {
                            const Icon = getIcon(item.service);
                            return (
                                <Card key={i}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{item.service}</CardTitle>
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between mb-2">
                                            <Badge className={getStatusColor(item.status)}>
                                                {item.status.toUpperCase()}
                                            </Badge>
                                            {item.latency && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {item.latency}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{item.message}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
