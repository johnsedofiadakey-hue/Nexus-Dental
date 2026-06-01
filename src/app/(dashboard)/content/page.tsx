"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Globe, FileText, HelpCircle, MessageSquare, Plus, Trash2,
    Save, Loader2, Info, ChevronRight, CheckCircle, Settings
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface FAQ {
    question: string;
    answer: string;
}

interface Testimonial {
    name: string;
    role: string;
    content: string;
    rating: number;
}

interface Article {
    title: string;
    content: string;
    category: string;
}

interface FeatureFlags {
    enableOnlineConsultation: boolean;
    enablePharmacy: boolean;
    enableTelehealth: boolean;
    enablePatientPortal: boolean;
}

export default function ContentManagerPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "settings" | "faqs" | "testimonials" | "education">("general");
    const [userContext, setUserContext] = useState<any>(null);

    const [content, setContent] = useState({
        aboutPage: "",
        mission: "",
        vision: "",
        faqs: [] as FAQ[],
        testimonials: [] as Testimonial[],
        educationArticles: [] as Article[]
    });

    const [settings, setSettings] = useState({
        platformName: "",
        featureFlags: {
            enableOnlineConsultation: true,
            enablePharmacy: true,
            enableTelehealth: true,
            enablePatientPortal: true,
        } as FeatureFlags
    });

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch User Context
                const meRes = await fetch("/api/auth/me");
                const meData = await meRes.json();
                if (meData.success) {
                    setUserContext(meData.data);
                }

                // Fetch Content
                const contentRes = await fetch("/api/clinic/content");
                const contentData = await contentRes.json();
                if (contentData.success && contentData.data) {
                    setContent({
                        aboutPage: contentData.data.aboutPage || "",
                        mission: contentData.data.mission || "",
                        vision: contentData.data.vision || "",
                        faqs: contentData.data.faqs || [],
                        testimonials: contentData.data.testimonials || [],
                        educationArticles: contentData.data.educationArticles || []
                    });
                }

                // Fetch Settings
                const settingsRes = await fetch("/api/clinic/settings");
                const settingsData = await settingsRes.json();
                if (settingsData.success && settingsData.data) {
                    setSettings({
                        platformName: settingsData.data.platformName || "",
                        featureFlags: settingsData.data.featureFlags || settings.featureFlags
                    });
                }
            } catch (error) {
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save Content
            const contentPromise = fetch("/api/clinic/content", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(content)
            });

            // Save Settings
            const settingsPromise = fetch("/api/clinic/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });

            const [contentRes, settingsRes] = await Promise.all([contentPromise, settingsPromise]);
            const contentData = await contentRes.json();
            const settingsData = await settingsRes.json();

            if (contentData.success && settingsData.success) {
                toast.success("All changes saved successfully");
            } else {
                toast.error("Failed to save some changes");
            }
        } catch (error) {
            toast.error("An error occurred while saving");
        } finally {
            setSaving(false);
        }
    };

    // FAQ Handlers
    const addFAQ = () => setContent(prev => ({ ...prev, faqs: [...prev.faqs, { question: "", answer: "" }] }));
    const removeFAQ = (index: number) => setContent(prev => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== index) }));
    const updateFAQ = (index: number, field: keyof FAQ, value: string) => {
        setContent(prev => {
            const newFaqs = [...prev.faqs];
            newFaqs[index] = { ...newFaqs[index], [field]: value };
            return { ...prev, faqs: newFaqs };
        });
    };

    // Testimonial Handlers
    const addTestimonial = () => setContent(prev => ({ ...prev, testimonials: [...prev.testimonials, { name: "", role: "", content: "", rating: 5 }] }));
    const removeTestimonial = (index: number) => setContent(prev => ({ ...prev, testimonials: prev.testimonials.filter((_, i) => i !== index) }));
    const updateTestimonial = (index: number, field: keyof Testimonial, value: any) => {
        setContent(prev => {
            const newTestimonials = [...prev.testimonials];
            newTestimonials[index] = { ...newTestimonials[index], [field]: value };
            return { ...prev, testimonials: newTestimonials };
        });
    };

    const toggleFeature = (feature: keyof FeatureFlags) => {
        setSettings(prev => ({
            ...prev,
            featureFlags: {
                ...prev.featureFlags,
                [feature]: !prev.featureFlags[feature]
            }
        }));
    };

    if (loading || !userContext) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    const tabs = [
        { id: "general", label: "Branding & About", icon: Info },
        { id: "settings", label: "Portal Features", icon: Settings },
        { id: "faqs", label: "FAQs", icon: HelpCircle },
        { id: "testimonials", label: "Testimonials", icon: MessageSquare },
        { id: "education", label: "Patient Education", icon: FileText },
    ];

    return (
        <DashboardLayout
            title="Content Manager"
            role={userContext.role}
            roles={userContext.roles}
            userName={`${userContext.firstName} ${userContext.lastName}`}
            userRoleLabel={userContext.role}
        >
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold flex items-center gap-2 text-slate-900">
                            <Globe className="w-8 h-8 text-teal-600" />
                            Portal Content Manager
                        </h2>
                        <p className="text-muted-foreground">Manage your clinic's public-facing presence and feature availability</p>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-teal-600 hover:bg-teal-700 h-12 px-8 shadow-md"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save All Changes
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Navigation Rail */}
                    <div className="space-y-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-xl text-sm font-medium transition-all group",
                                    activeTab === tab.id
                                        ? "bg-white text-teal-600 shadow-sm border border-teal-100"
                                        : "text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600")} />
                                    {tab.label}
                                </div>
                                <ChevronRight className={cn("w-4 h-4 transition-transform", activeTab === tab.id ? "rotate-90 text-teal-600" : "text-slate-300")} />
                            </button>
                        ))}
                    </div>

                    {/* Editor Area */}
                    <div className="lg:col-span-3 space-y-6">
                        {activeTab === "general" && (
                            <div className="space-y-6">
                                <Card className="shadow-sm border-slate-200">
                                    <CardHeader>
                                        <CardTitle>Clinic Branding</CardTitle>
                                        <CardDescription>Custom name shown in patients' portal</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="clinicName">Display Name Override</Label>
                                            <Input
                                                id="clinicName"
                                                placeholder="e.g. Nexus Premium Dental"
                                                value={settings.platformName}
                                                onChange={(e) => setSettings(prev => ({ ...prev, platformName: e.target.value }))}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm border-slate-200 overflow-hidden">
                                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                        <CardTitle>About Our Clinic</CardTitle>
                                        <CardDescription>Primary content for your clinic's about page</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="about">About Description</Label>
                                            <Textarea
                                                id="about"
                                                placeholder="Introduce your clinic, team, and specialized services..."
                                                value={content.aboutPage}
                                                onChange={(e) => setContent(prev => ({ ...prev, aboutPage: e.target.value }))}
                                                className="min-h-[200px]"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="mission">Mission Statement</Label>
                                                <Textarea
                                                    id="mission"
                                                    placeholder="Our mission is to..."
                                                    value={content.mission}
                                                    onChange={(e) => setContent(prev => ({ ...prev, mission: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="vision">Vision Statement</Label>
                                                <Textarea
                                                    id="vision"
                                                    placeholder="Our vision is to..."
                                                    value={content.vision}
                                                    onChange={(e) => setContent(prev => ({ ...prev, vision: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === "settings" && (
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Portal Features</CardTitle>
                                    <CardDescription>Toggle specific functionalities for your patients</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-4">
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                                        <div className="space-y-1">
                                            <h4 className="font-semibold text-slate-800">Online Consultation</h4>
                                            <p className="text-sm text-slate-500">Allow patients to book remote initial assessments</p>
                                        </div>
                                        <Switch
                                            checked={settings.featureFlags.enableOnlineConsultation}
                                            onCheckedChange={() => toggleFeature("enableOnlineConsultation")}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                                        <div className="space-y-1">
                                            <h4 className="font-semibold text-slate-800">Pharmacy Integration</h4>
                                            <p className="text-sm text-slate-500">Enable prescription history and refill requests</p>
                                        </div>
                                        <Switch
                                            checked={settings.featureFlags.enablePharmacy}
                                            onCheckedChange={() => toggleFeature("enablePharmacy")}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                                        <div className="space-y-1">
                                            <h4 className="font-semibold text-slate-800">Telehealth Video Calls</h4>
                                            <p className="text-sm text-slate-500">Activate built-in secure video conferencing for patients</p>
                                        </div>
                                        <Switch
                                            checked={settings.featureFlags.enableTelehealth}
                                            onCheckedChange={() => toggleFeature("enableTelehealth")}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-teal-50/30 border-teal-100">
                                        <div className="space-y-1">
                                            <h4 className="font-semibold text-teal-900 font-heading">Portal Maintenance Mode</h4>
                                            <p className="text-sm text-teal-700/80">Globally disable patient portal access for maintenance</p>
                                        </div>
                                        <Switch
                                            checked={!settings.featureFlags.enablePatientPortal}
                                            onCheckedChange={() => toggleFeature("enablePatientPortal")}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeTab === "faqs" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-slate-800">Frequently Asked Questions</h3>
                                    <Button variant="outline" size="sm" onClick={addFAQ} className="gap-2 border-teal-200 text-teal-600 hover:bg-teal-50">
                                        <Plus className="w-4 h-4" /> Add FAQ
                                    </Button>
                                </div>
                                {content.faqs.length === 0 ? (
                                    <Card className="border-dashed py-12 text-center text-muted-foreground bg-slate-50/30">
                                        No FAQs added yet.
                                    </Card>
                                ) : (
                                    content.faqs.map((faq, index) => (
                                        <Card key={index} className="shadow-sm">
                                            <CardContent className="p-6 space-y-4 relative">
                                                <button
                                                    onClick={() => removeFAQ(index)}
                                                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                                <div className="space-y-2 pr-8">
                                                    <Label>Question</Label>
                                                    <Input
                                                        placeholder="e.g. Do you accept insurance?"
                                                        value={faq.question}
                                                        onChange={(e) => updateFAQ(index, "question", e.target.value)}
                                                        className="h-10 font-semibold"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Answer</Label>
                                                    <Textarea
                                                        placeholder="Provide a clear, helpful answer..."
                                                        value={faq.answer}
                                                        onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                                                        className="min-h-[100px]"
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === "testimonials" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-slate-800">Patient Testimonials</h3>
                                    <Button variant="outline" size="sm" onClick={addTestimonial} className="gap-2 border-teal-200 text-teal-600 hover:bg-teal-50">
                                        <Plus className="w-4 h-4" /> Add Testimonial
                                    </Button>
                                </div>
                                {content.testimonials.length === 0 ? (
                                    <Card className="border-dashed py-12 text-center text-muted-foreground bg-slate-50/30">
                                        No testimonials added yet. Use them to build trust!
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {content.testimonials.map((t, index) => (
                                            <Card key={index} className="shadow-sm border-slate-200">
                                                <CardContent className="p-5 space-y-4">
                                                    <div className="flex justify-between gap-2">
                                                        <div className="flex-1 space-y-2">
                                                            <Input
                                                                placeholder="Patient Name"
                                                                value={t.name}
                                                                onChange={(e) => updateTestimonial(index, "name", e.target.value)}
                                                                className="h-9 text-sm font-bold"
                                                            />
                                                            <Input
                                                                placeholder="Role/Context (e.g. Regular Patient)"
                                                                value={t.role}
                                                                onChange={(e) => updateTestimonial(index, "role", e.target.value)}
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => removeTestimonial(index)}
                                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                    <Textarea
                                                        placeholder="What did the patient say?"
                                                        value={t.content}
                                                        onChange={(e) => updateTestimonial(index, "content", e.target.value)}
                                                        className="text-sm italic"
                                                    />
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "education" && (
                            <Card className="border-dashed py-20 bg-slate-50/20 text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Coming Soon: Patient Education Hub</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                                    Write and publish articles on dental hygiene, procedure aftercare, and more for your patients.
                                </p>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
