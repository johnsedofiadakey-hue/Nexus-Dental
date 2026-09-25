import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PublicBottomNav from "@/components/layout/PublicBottomNav";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Navbar />
            <main className="min-h-screen pt-20">
                {children}
            </main>
            <div className="pb-20 lg:pb-0"><Footer /></div>
            <PublicBottomNav />
        </>
    );
}
