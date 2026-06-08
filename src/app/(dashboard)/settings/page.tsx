"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch("/api/clinic/settings");
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data.settings);
                }
            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setLoading(false);
            }
        }
        fetchSettings();
    }, []);

    return (
        <DashboardLayout title="Clinic Settings">
            <div className="p-8 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Clinic Settings</h1>
                    <p className="text-slate-500">Manage your clinic preferences and configurations.</p>
                </div>

                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5 text-teal-600" />
                                General Configuration
                            </CardTitle>
                            <CardDescription>Update your clinic's primary colors and scheduling rules.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4 items-center border p-4 rounded-xl">
                                <div>
                                    <h4 className="font-semibold text-slate-900">Primary Color</h4>
                                    <p className="text-sm text-slate-500">Current: {settings?.primaryColor || '#000000'}</p>
                                </div>
                                <div className="ml-auto w-10 h-10 rounded-md border" style={{ backgroundColor: settings?.primaryColor || '#000000' }} />
                            </div>

                            <div className="flex gap-4 items-center border p-4 rounded-xl">
                                <div>
                                    <h4 className="font-semibold text-slate-900">Appointment Reminders</h4>
                                    <p className="text-sm text-slate-500">Automatically send SMS reminders</p>
                                </div>
                                <Button className="ml-auto" variant={settings?.enableSmsReminders ? "default" : "outline"}>
                                    {settings?.enableSmsReminders ? 'Enabled' : 'Disabled'}
                                </Button>
                            </div>

                            <div className="flex gap-4 items-center border p-4 rounded-xl">
                                <div>
                                    <h4 className="font-semibold text-slate-900">Online Booking</h4>
                                    <p className="text-sm text-slate-500">Allow patients to book online</p>
                                </div>
                                <Button className="ml-auto" variant={settings?.allowOnlineBooking ? "default" : "outline"}>
                                    {settings?.allowOnlineBooking ? 'Enabled' : 'Disabled'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
