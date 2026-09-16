"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitBranch as Github, Code2, Target, Award, Trophy, UserCircle, Loader2, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Class } from "@/types"

// Matches public.student_summary
type StudentSummaryRow = {
  reg_no: string
  easy_count: number | null
  medium_count: number | null
  hard_count: number | null
  current_streak: number | null
  yesterday_streak: number | null
  updated_at: string | null
}

// public.students row + embedded student_summary via the reg_no FK
type StudentWithSummary = {
  id: string
  reg_no: string
  name: string
  department: string
  year: number
  section: string
  class_id: string
  leetcode_username: string | null
  github_link: string | null
  student_summary: StudentSummaryRow | StudentSummaryRow[] | null
}

// Mirrors DashboardLayoutProps["userRole"] exactly. Keeping this as its
// own named type (rather than `string`) is what surfaces a compile error
// here if DashboardLayout's accepted roles ever change, instead of a
// runtime prop-type mismatch.
type DashboardRole =
  | "HOD"
  | "Teacher"
  | "Tutor"
  | "Class Advisor"
  | "Staff"
  | "Dean"

const DASHBOARD_ROLES: readonly DashboardRole[] = [
  "HOD",
  "Teacher",
  "Tutor",
  "Class Advisor",
  "Staff",
  "Dean",
]

// staff.role comes back from Supabase as an untyped string, so it can't be
// assigned straight into state typed as DashboardRole. This validates it
// against the roles DashboardLayout actually accepts and falls back to
// "Staff" for anything unexpected, rather than casting blindly.
function toDashboardRole(role: unknown): DashboardRole {
  return typeof role === "string" &&
    (DASHBOARD_ROLES as readonly string[]).includes(role)
    ? (role as DashboardRole)
    : "Staff"
}

// The logged-in staff member viewing this page (for the layout header)
type CurrentStaff = {
  name: string
  role: DashboardRole
}

export default function StudentProfile() {
  const params = useParams<{ id: string }>()
  // The "View Profile" link passes the student's reg_no in this segment
  const regNo = params?.id as string

  const [student, setStudent] = useState<StudentWithSummary | null>(null)
  const [summary, setSummary] = useState<StudentSummaryRow | null>(null)
  const [classData, setClassData] = useState<Class | null>(null)
  const [currentStaff, setCurrentStaff] = useState<CurrentStaff | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // 1. Who's logged in — used for the DashboardLayout header, not for
      //    authorizing the student fetch below.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted) return

      if (user) {
        const { data: staffRow } = await supabase
          .from("staff")
          .select("name, role")
          .eq("user_id", user.id)
          .maybeSingle()

        if (isMounted && staffRow) {
          setCurrentStaff({
            name: staffRow.name,
            role: toDashboardRole(staffRow.role),
          })
        }
      }

      // student_summary is keyed by reg_no (not student_id), and the FK lets
      // PostgREST embed it directly off the students table in one call.
      const { data: studentResult, error: studentError } = await supabase
        .from("students")
        .select("*, student_summary(*)")
        .eq("reg_no", regNo)
        .maybeSingle()

      if (!isMounted) return

      if (studentError) {
        setError(studentError.message)
        setLoading(false)
        return
      }

      if (!studentResult) {
        setLoading(false)
        return
      }

      setStudent(studentResult)

      const embeddedSummary = Array.isArray(studentResult.student_summary)
        ? studentResult.student_summary[0] || null
        : studentResult.student_summary || null
      setSummary(embeddedSummary)

      const { data: classResult } = await supabase
        .from("classes")
        .select("*")
        .eq("id", studentResult.class_id)
        .maybeSingle()

      if (!isMounted) return

      if (classResult) {
        setClassData(classResult)
      }

      setLoading(false)
    }

    // React's set-state-in-effect diagnostic flags any setState reachable
    // synchronously from the effect body. The `else { setLoading(false) }`
    // branch below used to run directly inside the effect, and loadData
    // itself calls setLoading(true) before its first await, so calling it
    // straight from the effect tripped the same check. Deferring both
    // branches into a microtask keeps the exact same "fetch when regNo is
    // present, otherwise stop loading" behavior while ensuring no setState
    // runs synchronously within the effect's own call stack.
    Promise.resolve().then(() => {
      if (!isMounted) return

      if (regNo) {
        loadData()
      } else {
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [regNo])

  if (loading) {
    return (
      <DashboardLayout
        userRole={currentStaff?.role || "Staff"}
        userName={currentStaff?.name || "Loading..."}
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !student) {
    return (
      <DashboardLayout
        userRole={currentStaff?.role || "Staff"}
        userName={currentStaff?.name || "Staff"}
      >
        <div className="flex h-96 flex-col items-center justify-center gap-4">
          <h2 className="text-xl font-semibold">Student not found</h2>
          <p className="text-gray-500">
            {error || "The requested student profile does not exist in the database."}
          </p>
        </div>
      </DashboardLayout>
    )
  }

  const easy = summary?.easy_count ?? 0
  const medium = summary?.medium_count ?? 0
  const hard = summary?.hard_count ?? 0
  const totalSolved = easy + medium + hard
  const currentStreak = summary?.current_streak ?? 0

  return (
    <DashboardLayout
      userRole={currentStaff?.role || "Staff"}
      userName={currentStaff?.name || "Staff"}
    >
      <div className="flex flex-col space-y-6 pb-12">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center p-6 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex-shrink-0">
            <UserCircle className="h-24 w-24 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{student.name}</h1>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="font-mono">
                  {student.reg_no}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {classData
                  ? `${classData.department} Y${classData.year} ${classData.section}`
                  : `${student.department} Y${student.year} ${student.section}`}
              </div>
              {student.leetcode_username && (
                <div className="flex items-center gap-1">
                  <Code2 className="h-4 w-4" />
                  <a
                    href={`https://leetcode.com/u/${student.leetcode_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {student.leetcode_username}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {student.github_link && student.github_link !== "link" && (
                <div className="flex items-center gap-1">
                  <Github className="h-4 w-4" />
                  <a
                    href={student.github_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-100 dark:border-orange-900/50">
            <div className="text-sm font-medium text-orange-800 dark:text-orange-400 flex items-center gap-2">
              <Award className="h-4 w-4" /> Current Streak
            </div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">
              {currentStreak} <span className="text-sm font-normal">days</span>
            </div>
            {summary?.yesterday_streak != null && (
              <p className="text-xs text-orange-700/70 dark:text-orange-400/70">
                Yesterday: {summary.yesterday_streak} days
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Solved</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalSolved}</div>
              <p className="text-xs text-gray-500 mt-1">Easy + Medium + Hard</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Easy</CardTitle>
              <span className="h-3 w-3 rounded-full bg-green-500"></span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">{easy}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Medium</CardTitle>
              <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{medium}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hard</CardTitle>
              <span className="h-3 w-3 rounded-full bg-red-500"></span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-500">{hard}</div>
            </CardContent>
          </Card>
        </div>

       
      </div>
    </DashboardLayout>
  )
}