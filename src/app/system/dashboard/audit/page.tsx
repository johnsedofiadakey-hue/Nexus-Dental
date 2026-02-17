"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, User, Calendar } from "lucide-react";

export default function AuditPage() {
    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="Audit Logs"
            userName="Super Admin"
            userRoleLabel="System Owner"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold">System Audit Logs</h2>
                    <p className="text-muted-foreground">Monitor all system-wide activity and security events</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest audit trail entries across all tenants</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                {
                                    action: "USER_LOGIN",
                                    user: "admin@nexusdental.com",
                                    timestamp: "2026-02-17 10:00:00",
                                    status: "SUCCESS",
                                },
                                {
                                    action: "PATIENT_CREATED",
                                    user: "sarah@airporthills.com",
                                    timestamp: "2026-02-17 09:45:00",
                                    status: "SUCCESS",
                                },
                                {
                                    action: "INVENTORY_ADJUSTED",
                                    user: "dr.smith@ridge.dental",
                                    timestamp: "2026-02-17 09:30:00",
                                    status: "SUCCESS",
                                },
                            ].map((log, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{log.action}</p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                <User className="w-3 h-3" />
                                                {log.user}
                                                <Calendar className="w-3 h-3 ml-2" />
                                                {log.timestamp}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={log.status === "SUCCESS" ? "success" : "destructive"}>
                                        {log.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
