"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Sidebar from "./Sidebar"
import TopNav from "./TopNav"
import ClassDetailPanel from "@/components/staff-dashboard/ClassDetailPanel"
import { Class } from "@/types"

interface DashboardLayoutProps {
  children: React.ReactNode
  userRole?: "HOD" | "Teacher" | "Tutor" | "Class Advisor" | "Staff"
  userName?: string
}

export default function DashboardLayout({
  children,
  userRole = "HOD",
  userName = "Dr. Alan Turing",
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const router = useRouter()

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed", error)
    }
  }

  // Called by the Sidebar's "Classes" list. No navigation happens — this just
  // swaps what renders in <main>, so the sidebar itself never re-mounts.
  const handleSelectClass = (cls: Class | null) => {
    setSelectedClass(cls)
    setIsSidebarOpen(false) // close the mobile drawer if it was open
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop and Mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          role={userRole}
          onLogout={handleLogout}
          selectedClassId={selectedClass?.id ?? null}
          onSelectClass={handleSelectClass}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          onMenuClick={() => setIsSidebarOpen(true)}
          userRole={userRole}
          userName={userName}
        />

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900/50 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {selectedClass ? <ClassDetailPanel classInfo={selectedClass} /> : children}
          </div>
        </main>
      </div>
    </div>
  )
}