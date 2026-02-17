"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Calendar, FileText } from "lucide-react";

export default function FinanceDashboardPage() {
    return (
        <DashboardLayout
            role="BILLING_STAFF"
            title="Finance Dashboard"
            userName="Finance Officer"
            userRoleLabel="Billing Staff"
        >
            <div className="space-y-6">
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Monthly Revenue
                            </CardTitle>
                            <DollarSign className="w-4 h-4 text-teal-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">GH₵ 45,230</div>
                            <p className="text-xs text-muted-foreground">+12.5% from last month</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Outstanding Balance
                            </CardTitle>
                            <FileText className="w-4 h-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">GH₵ 8,450</div>
                            <p className="text-xs text-muted-foreground">12 pending invoices</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Payments Today
                            </CardTitle>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">GH₵ 2,340</div>
                            <p className="text-xs text-muted-foreground">8 transactions</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                This Week
                            </CardTitle>
                            <Calendar className="w-4 h-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">GH₵ 14,680</div>
                            <p className="text-xs text-muted-foreground">32 transactions</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground text-center py-8">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p>Invoice management coming soon</p>
                            <p className="text-xs mt-2">Navigate to Invoices section for detailed billing</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
