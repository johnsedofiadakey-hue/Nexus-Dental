"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Globe, Mail, Phone, Palette } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        platformName: "Nexus Dental",
        supportEmail: "support@nexusdental.com",
        supportPhone: "+233 24 123 4567",
        logoUrl: "",
        faviconUrl: "",
        primaryColor: "#008080",
        secondaryColor: "#FFD700",
        emailFooter: "",
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/system/settings");
            const data = await res.json();
            if (data.success && data.data) {
                setSettings(data.data);
            }
        } catch (error) {
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/system/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Settings updated successfully");
            } else {
                toast.error(data.error || "Failed to update settings");
            }
        } catch (error) {
            toast.error("An error occurred while saving");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <DashboardLayout
            role="SYSTEM_OWNER"
            title="Global Settings"
            userName="Super Admin"
            userRoleLabel="System Owner"
        >
            <div className="space-y-6 pb-12">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-bold">Global Configuration</h2>
                        <p className="text-muted-foreground">
                            Manage platform-wide branding, communication, and system settings
                        </p>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Platform Branding */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-teal-600" />
                                Platform Branding
                            </CardTitle>
                            <CardDescription>
                                Core identity settings for the entire SaaS platform
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="platform-name">Platform Name</Label>
                                <Input
                                    id="platform-name"
                                    value={settings.platformName}
                                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="logo-url">Global Logo URL</Label>
                                <Input
                                    id="logo-url"
                                    value={settings.logoUrl || ""}
                                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                                    placeholder="https://example.com/logo.png"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="favicon-url">Favicon URL</Label>
                                <Input
                                    id="favicon-url"
                                    value={settings.faviconUrl || ""}
                                    onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value })}
                                    placeholder="https://example.com/favicon.ico"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Support & Contact */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="w-5 h-5 text-teal-600" />
                                Support & Contact
                            </CardTitle>
                            <CardDescription>
                                Platform-level contact information for tenants
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="support-email">Global Support Email</Label>
                                <Input
                                    id="support-email"
                                    type="email"
                                    value={settings.supportEmail || ""}
                                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-phone">Global Support Phone</Label>
                                <Input
                                    id="contact-phone"
                                    value={settings.supportPhone || ""}
                                    onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email-footer">Global Email Footer</Label>
                                <Textarea
                                    id="email-footer"
                                    value={settings.emailFooter || ""}
                                    onChange={(e) => setSettings({ ...settings, emailFooter: e.target.value })}
                                    placeholder="© 2024 Nexus Dental. All rights reserved."
                                    className="min-h-[100px]"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Visual Theme */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="border-b bg-slate-50/50">
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-teal-600" />
                                Visual Theme
                            </CardTitle>
                            <CardDescription>
                                Default color palette for the platform
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Primary Color</Label>
                                    <div className="flex gap-2">
                                        <div
                                            className="w-10 h-10 rounded-lg border border-slate-200"
                                            style={{ backgroundColor: settings.primaryColor }}
                                        />
                                        <Input
                                            value={settings.primaryColor}
                                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                                            className="font-mono uppercase"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Secondary Color</Label>
                                    <div className="flex gap-2">
                                        <div
                                            className="w-10 h-10 rounded-lg border border-slate-200"
                                            style={{ backgroundColor: settings.secondaryColor }}
                                        />
                                        <Input
                                            value={settings.secondaryColor}
                                            onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                                            className="font-mono uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-muted-foreground">
                                These colors define the platform-wide primary and secondary styles unless overridden by tenant-specific branding.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
