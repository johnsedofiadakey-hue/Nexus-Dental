import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ success: true });

    response.cookies.set("nexus_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    response.cookies.set("nexus_patient_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return response;
}
