"use client";

import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function problems(pw: string): string[] {
    const out: string[] = [];
    if (pw.length < 8) out.push("at least 8 characters");
    if (!/[A-Z]/.test(pw)) out.push("an uppercase letter");
    if (!/[a-z]/.test(pw)) out.push("a lowercase letter");
    if (!/[0-9]/.test(pw)) out.push("a number");
    if (!/[!@#$%^&*()_+\-=[\]{};':"|,.<>?/]/.test(pw)) out.push("a special character");
    return out;
}

export default function SecurityPage() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [saving, setSaving] = useState(false);

    const missing = problems(next);
    const canSubmit = current && missing.length === 0 && next === confirm && !saving;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Password updated");
                setCurrent("");
                setNext("");
                setConfirm("");
            } else {
                toast.error(data.error || "Could not update password");
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <DashboardLayout title="Security">
            <div className="max-w-xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-teal-600" /> Change password
                        </CardTitle>
                        <CardDescription>
                            Use a long, unique password. You&apos;ll need your current password to make this change.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            <div className="space-y-2">
                                <Label htmlFor="current">Current password</Label>
                                <Input
                                    id="current"
                                    type="password"
                                    autoComplete="current-password"
                                    value={current}
                                    onChange={(e) => setCurrent(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="next">New password</Label>
                                <Input
                                    id="next"
                                    type="password"
                                    autoComplete="new-password"
                                    value={next}
                                    onChange={(e) => setNext(e.target.value)}
                                />
                                {next.length > 0 && missing.length > 0 && (
                                    <p className="text-xs text-amber-600">Needs {missing.join(", ")}.</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm">Confirm new password</Label>
                                <Input
                                    id="confirm"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                />
                                {confirm.length > 0 && confirm !== next && (
                                    <p className="text-xs text-red-600">Passwords do not match.</p>
                                )}
                            </div>
                            <Button type="submit" disabled={!canSubmit} className="bg-teal-600 hover:bg-teal-700">
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Update password
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
