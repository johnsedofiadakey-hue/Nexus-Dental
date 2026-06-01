"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, CheckCircle2, XCircle, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

interface Review {
    id: string;
    authorName: string;
    rating: number;
    comment: string;
    isApproved: boolean;
    createdAt: string;
    patient?: { firstName: string; lastName: string } | null;
}

function Stars({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className={`w-4 h-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
            ))}
        </div>
    );
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function fetchReviews(tenantId: string) {
    const res = await fetch(`/api/reviews?tenantId=${tenantId}&all=true`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed");
    return (await res.json()).data.reviews as Review[];
}

async function moderateReview(id: string, approve: boolean) {
    const res = await fetch(`/api/system/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: approve }),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
}

export default function ReviewsPage() {
    const { data: user } = useCurrentUser();
    const qc = useQueryClient();

    const { data: reviews = [], isLoading, isError } = useQuery({
        queryKey: ["reviews", user?.tenantId],
        queryFn: () => fetchReviews(user!.tenantId!),
        enabled: !!user?.tenantId,
    });

    const moderateMutation = useMutation({
        mutationFn: ({ id, approve }: { id: string; approve: boolean }) => moderateReview(id, approve),
        onSuccess: (_, { approve }) => {
            qc.invalidateQueries({ queryKey: ["reviews"] });
            toast.success(approve ? "Review approved and published" : "Review rejected");
        },
        onError: () => toast.error("Failed to update review"),
    });

    const pending  = reviews.filter(r => !r.isApproved);
    const approved = reviews.filter(r => r.isApproved);
    const avgRating = approved.length > 0
        ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1)
        : "—";

    return (
        <DashboardLayout title="Patient Reviews">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Patient Reviews</h2>
                    <p className="text-slate-500">Moderate and publish patient feedback. Approved reviews appear on your public page.</p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-none shadow-sm ring-1 ring-amber-100 bg-amber-50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Star className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-900">Average Rating</p>
                            <p className="text-3xl font-bold text-amber-800">{avgRating} <span className="text-sm font-normal">/ 5</span></p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-emerald-100 bg-emerald-50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-900">Published Reviews</p>
                            <p className="text-3xl font-bold text-emerald-800">{approved.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`border-none shadow-sm ${pending.length > 0 ? "ring-1 ring-red-100 bg-red-50" : "ring-1 ring-slate-100"}`}>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pending.length > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                            <AlertCircle className={`w-6 h-6 ${pending.length > 0 ? "text-red-600" : "text-slate-400"}`} />
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${pending.length > 0 ? "text-red-900" : "text-slate-700"}`}>Pending Approval</p>
                            <p className={`text-3xl font-bold ${pending.length > 0 ? "text-red-800" : "text-slate-500"}`}>{pending.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isLoading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-teal-600 animate-spin" /></div>}

            {/* Pending Reviews */}
            {!isLoading && pending.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" /> Awaiting Moderation ({pending.length})
                    </h3>
                    <div className="space-y-4">
                        {pending.map(review => (
                            <Card key={review.id} className="border-none shadow-sm ring-1 ring-red-100">
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                                                    {review.authorName[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{review.authorName}</p>
                                                    <p className="text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                                                </div>
                                                <Stars rating={review.rating} />
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Button size="sm" variant="outline"
                                                className="text-red-600 border-red-200 hover:bg-red-50"
                                                onClick={() => moderateMutation.mutate({ id: review.id, approve: false })}
                                                disabled={moderateMutation.isPending}>
                                                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                            </Button>
                                            <Button size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => moderateMutation.mutate({ id: review.id, approve: true })}
                                                disabled={moderateMutation.isPending}>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Approved Reviews */}
            {!isLoading && (
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Published Reviews ({approved.length})
                    </h3>
                    {approved.length === 0 ? (
                        <Card className="border-none shadow-sm ring-1 ring-slate-100">
                            <CardContent className="p-12 text-center text-slate-400">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No published reviews yet. Approve pending reviews to show them on your public page.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {approved.map(review => (
                                <Card key={review.id} className="border-none shadow-sm ring-1 ring-slate-100">
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center font-bold text-teal-700 text-sm">
                                                {review.authorName[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">{review.authorName}</p>
                                                <p className="text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                                            </div>
                                        </div>
                                        <Stars rating={review.rating} />
                                        <p className="text-sm text-slate-600 mt-3 leading-relaxed line-clamp-3">{review.comment}</p>
                                        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 text-xs"
                                                onClick={() => moderateMutation.mutate({ id: review.id, approve: false })}
                                                disabled={moderateMutation.isPending}>
                                                Unpublish
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}
