"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  UserCog,
  Settings,
  LogOut,
  CodeSquare,
  School,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Activity,
} from "lucide-react"
import { useStaffClasses } from "@/lib/hooks/use-staff-classes"
import { Class } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import SettingsPanel from "@/components/staff-dashboard/settings/SettingsPanel"

interface SidebarProps {
  role?: "HOD" | "Teacher" | "Tutor" | "Class Advisor" | "Staff"
  onLogout: () => void
  selectedClassId: string | null
  onSelectClass: (cls: Class | null) => void
}

export default function Sidebar({ role = "HOD", onLogout, selectedClassId, onSelectClass }: SidebarProps) {
  const pathname = usePathname()
  const { classes, loading: classesLoading } = useStaffClasses()

  const [isClassesOpen, setIsClassesOpen] = useState(!!selectedClassId)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const topLinks =
    role === "HOD"
      ? [
          { title: "Dashboard", href: "/dashboard/hod", icon: LayoutDashboard },
          { title: "All Students", href: "/dashboard/staff/students", icon: Users },
          { title: "Staff", href: "/dashboard/staff/staff-detail", icon: UserCog },
        ]
      : [{ title: "Dashboard", href: "/dashboard/staff", icon: LayoutDashboard }]

  // Same for every role — not gated by HOD vs Teacher/Tutor/Class Advisor.
  const commonLinks = [
    { title: "Tasks", href: "/dashboard/staff/task", icon: ListTodo },
    { title: "Activity", href: "/dashboard/staff/activity", icon: Activity },
  ]

  const handleDashboardClick = () => {
    // Clicking a real nav link should drop back out of the class view
    onSelectClass(null)
  }

  const renderLink = (link: { title: string; href: string; icon: typeof LayoutDashboard }) => {
    const isActive = !selectedClassId && (pathname === link.href || pathname.startsWith(link.href + "/"))
    return (
      <Link
        key={link.title}
        href={link.href}
        onClick={handleDashboardClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
        )}
      >
        <link.icon
          className={cn(
            "h-4 w-4",
            isActive ? "text-blue-700 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
          )}
        />
        {link.title}
      </Link>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50/40 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link
          href="/dashboard"
          onClick={handleDashboardClick}
          className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-50"
        >
          <CodeSquare className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <span>LeetCode Portal</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-4">
          {topLinks.map(renderLink)}

          {/* Visible to every role, unlike topLinks above */}
          {commonLinks.map(renderLink)}

          {/* Classes — expandable list. Clicking a class swaps the main content
              area in place via onSelectClass; it does NOT navigate. */}
          <div>
            <button
              onClick={() => setIsClassesOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                selectedClassId
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
              )}
            >
              <span className="flex items-center gap-3">
                <School
                  className={cn(
                    "h-4 w-4",
                    selectedClassId ? "text-blue-700 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                  )}
                />
                Classes
              </span>
              {isClassesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {isClassesOpen && (
              <div className="mt-1 space-y-1 pl-9">
                {classesLoading && <p className="px-2 py-1 text-xs text-gray-400">Loading...</p>}

                {!classesLoading && classes.length === 0 && (
                  <p className="px-2 py-1 text-xs text-gray-400">No classes</p>
                )}

                {classes.map((cls) => {
                  const isActive = selectedClassId === cls.id
                  const label = cls.name || `Y${cls.year} ${cls.section}`
                  return (
                    <button
                      key={cls.id}
                      onClick={() => onSelectClass(cls)}
                      className={cn(
                        "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                        isActive
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Settings — opens the SettingsPanel in a Dialog instead of
              navigating to a dedicated /dashboard/settings route. */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <button
              onClick={() => setSettingsOpen(true)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                settingsOpen
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
              )}
            >
              <Settings
                className={cn(
                  "h-4 w-4",
                  settingsOpen ? "text-blue-700 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                )}
              />
              Settings
            </button>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="sr-only">Settings</DialogTitle>
              </DialogHeader>
              <SettingsPanel />
            </DialogContent>
          </Dialog>
        </nav>
      </div>

      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-500"
        >
          <LogOut className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          Logout
        </button>
      </div>
    </div>
  )
}