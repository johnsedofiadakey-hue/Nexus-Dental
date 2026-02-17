"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save } from "lucide-react";

export default function SettingsPage() {
    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="Global Settings"
            userName="Super Admin"
            userRoleLabel="System Owner"
        >
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold">Global Configuration</h2>
                    <p className="text-muted-foreground">
                        Manage platform-wide settings and configurations
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Platform Branding</CardTitle>
                        <CardDescription>
                            Configure the global branding for the Nexus Dental platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="platform-name">Platform Name</Label>
                            <Input
                                id="platform-name"
                                defaultValue="Nexus Dental"
                                placeholder="Enter platform name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="support-email">Support Email</Label>
                            <Input
                                id="support-email"
                                type="email"
                                defaultValue="support@nexusdental.com"
                                placeholder="Enter support email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact-phone">Contact Phone</Label>
                            <Input
                                id="contact-phone"
                                defaultValue="+233 24 123 4567"
                                placeholder="Enter contact phone"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>System Configuration</CardTitle>
                        <CardDescription>Advanced system-level settings</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="jwt-secret">JWT Secret Key</Label>
                            <Input
                                id="jwt-secret"
                                type="password"
                                defaultValue="●●●●●●●●●●●●●●●●"
                                placeholder="Enter JWT secret"
                            />
                            <p className="text-xs text-muted-foreground">
                                Changing this will invalidate all active sessions
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
                            <Input
                                id="session-timeout"
                                type="number"
                                defaultValue="24"
                                placeholder="Enter session timeout"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button className="gap-2">
                        <Save className="w-4 h-4" />
                        Save Changes
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
}
