"use client";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import ImpersonationBanner from "@/components/ImpersonationBanner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <Navbar />
      <main className="w-full min-w-0 !pt-16 lg:pl-64 bg-gray-50 min-h-screen">
        <ImpersonationBanner />
        {children}
      </main>
    </div>
  );
}


