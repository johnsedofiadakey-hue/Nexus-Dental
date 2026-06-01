"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, Search, Mail, Clock, Trash2, Loader2,
    UserCheck, ShieldAlert, X, CheckCircle2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StaffMember {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: { systemRole: string | null }[];
    status: string;
    lastLoginAt?: string;
    avatar?: string;
    createdAt: string;
}

interface PendingInvite {
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    createdAt: string;
    invitedBy: { firstName: string; lastName: string };
}

const ROLE_COLORS: Record<string, string> = {
    CLINIC_OWNER:      "bg-teal-100 text-teal-800",
    ADMIN:             "bg-indigo-100 text-indigo-800",
    DOCTOR:            "bg-blue-100 text-blue-800",
    NURSE:             "bg-green-100 text-green-800",
    RECEPTIONIST:      "bg-purple-100 text-purple-800",
    INVENTORY_MANAGER: "bg-orange-100 text-orange-800",
    BILLING_STAFF:     "bg-pink-100 text-pink-800",
};

const INVITABLE_ROLES = [
    { value: "DOCTOR",            label: "Doctor" },
    { value: "NURSE",             label: "Nurse" },
    { value: "RECEPTIONIST",      label: "Receptionist" },
    { value: "ADMIN",             label: "Admin" },
    { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
    { value: "BILLING_STAFF",     label: "Billing Staff" },
];

function roleLabel(r: string) {
    return r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isExpired(d: string) { return new Date(d) < new Date(); }

function InviteModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
    const qc = useQueryClient();
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("DOCTOR");

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/staff/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: email.trim().toLowerCase(), role, tenantId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to send invite");
            return json;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["pending-invites"] });
            toast.success(`Invitation sent to ${email}`);
            onClose();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Invite Staff Member</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Work Email Address</label>
                        <Input type="email" placeholder="doctor@clinic.com" value={email}
                            onChange={e => setEmail(e.target.value)} autoFocus />
                        <p className="text-xs text-slate-400 mt-1">They must sign in with this exact Google account.</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            {INVITABLE_ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="p-4 rounded-xl bg-teal-50 ring-1 ring-teal-100 text-sm text-teal-800">
                        <p className="font-medium mb-1">How this works</p>
                        <ol className="list-decimal ml-4 space-y-1 text-teal-700 text-xs">
                            <li>An invitation email is sent to this address.</li>
                            <li>They click the link and sign in with Google.</li>
                            <li>Their account is automatically created with the chosen role.</li>
                            <li>The link expires in 48 hours.</li>
                        </ol>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button className="flex-1 bg-teal-600 hover:bg-teal-700"
                        disabled={!email || mutation.isPending} onClick={() => mutation.mutate()}>
                        {mutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                            : <><Mail className="w-4 h-4 mr-2" />Send Invite</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function StaffManagementPage() {
    const { data: currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [tab, setTab] = useState<"active" | "invites">("active");

    const tenantId = currentUser?.tenantId;

    const { data: staffData, isLoading: loadingStaff } = useQuery({
        queryKey: ["staff", tenantId],
        queryFn: async () => {
            const res = await fetch(`/api/staff?tenantId=${tenantId}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return (await res.json()).data as { staff: StaffMember[] };
        },
        enabled: !!tenantId,
    });

    const { data: inviteData, isLoading: loadingInvites } = useQuery({
        queryKey: ["pending-invites", tenantId],
        queryFn: async () => {
            const res = await fetch(`/api/staff/invite?tenantId=${tenantId}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return (await res.json()).data as { invites: PendingInvite[] };
        },
        enabled: !!tenantId,
    });

    const revokeInvite = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/staff/invite?id=${id}`, { method: "DELETE", credentials: "include" });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending-invites"] }); toast.success("Invite revoked"); },
        onError: () => toast.error("Failed to revoke invite"),
    });

    const staff = staffData?.staff ?? [];
    const invites = inviteData?.invites ?? [];
    const filteredStaff = staff.filter(s =>
        !search || `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase())
    );
    const pendingCount = invites.filter(i => !isExpired(i.expiresAt)).length;

    return (
        <DashboardLayout title="Staff Management">
            {showInviteModal && tenantId && (
                <InviteModal tenantId={tenantId} onClose={() => setShowInviteModal(false)} />
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Staff Management</h2>
                    <p className="text-slate-500 mt-1">Invite team members and manage their access roles.</p>
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700 shrink-0" onClick={() => setShowInviteModal(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Invite Staff
                </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Active Staff</p>
                            <p className="text-2xl font-bold text-slate-900">{staff.filter(s => s.status === "ACTIVE").length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-amber-100 bg-amber-50">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-amber-700">Pending Invites</p>
                            <p className="text-2xl font-bold text-amber-800">{pendingCount}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-slate-100">
                    <CardContent className="p-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Inactive</p>
                            <p className="text-2xl font-bold text-slate-700">{staff.filter(s => s.status !== "ACTIVE").length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
                <button onClick={() => setTab("active")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        tab === "active" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
                    Active Staff ({staff.length})
                </button>
                <button onClick={() => setTab("invites")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                        tab === "invites" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
                    Pending Invites
                    {pendingCount > 0 && (
                        <span className="w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Active Staff */}
            {tab === "active" && (
                <>
                    <div className="relative mb-4 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Search staff…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    {loadingStaff && (
                        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
                    )}

                    {!loadingStaff && filteredStaff.length === 0 && (
                        <Card className="border-none shadow-sm ring-1 ring-slate-100">
                            <CardContent className="p-16 text-center">
                                <UserCheck className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                                <p className="text-slate-500">No staff members yet.</p>
                                <p className="text-sm text-slate-400 mt-1">Click "Invite Staff" to get started.</p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-3">
                        {filteredStaff.map(member => {
                            const primaryRole = member.roles[0]?.systemRole ?? "—";
                            return (
                                <Card key={member.id} className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 text-sm shrink-0 overflow-hidden">
                                            {member.avatar
                                                ? <img src={member.avatar} alt="" className="w-11 h-11 object-cover" />
                                                : `${member.firstName[0]}${member.lastName[0]}`}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{member.firstName} {member.lastName}</p>
                                            <p className="text-sm text-slate-400 truncate">{member.email}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
                                                ROLE_COLORS[primaryRole] ?? "bg-slate-100 text-slate-700")}>
                                                {roleLabel(primaryRole)}
                                            </span>
                                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                                                member.status === "ACTIVE"
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-red-50 text-red-700")}>
                                                {member.status}
                                            </span>
                                            {member.lastLoginAt && (
                                                <p className="text-xs text-slate-400 hidden lg:block">
                                                    Last login {formatDate(member.lastLoginAt)}
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Pending Invites */}
            {tab === "invites" && (
                <>
                    {loadingInvites && (
                        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
                    )}

                    {!loadingInvites && invites.length === 0 && (
                        <Card className="border-none shadow-sm ring-1 ring-slate-100">
                            <CardContent className="p-16 text-center">
                                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-200" />
                                <p className="text-slate-500">No pending invitations.</p>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-3">
                        {invites.map(invite => {
                            const expired = isExpired(invite.expiresAt);
                            return (
                                <Card key={invite.id} className={cn("border-none shadow-sm",
                                    expired ? "ring-1 ring-red-100 opacity-60" : "ring-1 ring-amber-100")}>
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                                            <Mail className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{invite.email}</p>
                                            <p className="text-sm text-slate-400">
                                                Invited as <span className="font-medium">{roleLabel(invite.role)}</span>
                                                {" · "}by {invite.invitedBy.firstName} {invite.invitedBy.lastName}
                                                {" · "}{expired
                                                    ? <span className="text-red-500">Expired</span>
                                                    : `Expires ${formatDate(invite.expiresAt)}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!expired && (
                                                <Badge className="bg-amber-100 text-amber-700 border-none text-xs">
                                                    <Clock className="w-3 h-3 mr-1" /> Pending
                                                </Badge>
                                            )}
                                            {expired && (
                                                <Badge className="bg-red-50 text-red-600 border-none text-xs">Expired</Badge>
                                            )}
                                            <Button size="sm" variant="ghost"
                                                className="text-red-500 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => revokeInvite.mutate(invite.id)}
                                                disabled={revokeInvite.isPending}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </DashboardLayout>
    );
}
