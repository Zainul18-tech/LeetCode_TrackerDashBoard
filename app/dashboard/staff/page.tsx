"use client"

import { useEffect, useState } from "react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Users,
  FileEdit,
  Search,
  Loader2,
  ExternalLink,
  Trophy,
  Flame,
  ClipboardList,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Student, Class } from "@/types"
import SettingsPanel from "@/components/staff-dashboard/settings/SettingsPanel"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// Staff row shape from public.staff
type Staff = {
  id: string
  name: string
  email: string
  role: "HOD" | "Teacher" | "Tutor" | "Class Advisor" | "Dean"
  department: string
  year: number | null
  section: string | null
  user_id: string | null
}

// Matches public.student_summary — only current totals are stored, no
// historical daily snapshots, so a "last 7 days" trend isn't derivable.
// IMPORTANT: current_streak lives HERE, keyed by reg_no — it is NOT a
// column on public.students. Any code that reads student.current_streak
// directly (without merging this in) will always see undefined -> 0.
type StudentSummaryRow = {
  reg_no: string
  easy_count: number | null
  medium_count: number | null
  hard_count: number | null
  current_streak: number | null
  yesterday_streak: number | null
  updated_at: string | null
}

// Student row enriched with the student_summary fields merged in by reg_no.
type StudentWithStats = Student & {
  current_streak: number
  yesterday_streak: number
  easy_count: number
  medium_count: number
  hard_count: number
  total_solved: number
}

type DifficultyTotals = {
  easy: number
  medium: number
  hard: number
}

// Matches public.tasks (see tasks-schema.sql). Only the fields needed to
// work out whether a task applies to this staff member's scope.
type TaskRow = {
  id: string
  department: string
  target_years: number[] | null
  applies_to_all_classes: boolean
  task_classes?: { class_id: string }[]
}

const getRegNoFromStudent = (s: Student) => s.reg_no || s.register_number || ""

// A task is "in scope" if it targets any class currently in `scopeClasses`
// — which is already role-scoped by the time this runs: every class in the
// department for an HOD, every class in the institution for a Dean, or
// just the classes this staff member is assigned to otherwise.
function isTaskInScope(task: TaskRow, scopeClasses: Class[]): boolean {
  if (task.applies_to_all_classes) {
    if (!task.target_years || task.target_years.length === 0) return true
    return scopeClasses.some((c) => task.target_years!.includes(c.year))
  }
  const explicitClassIds = new Set((task.task_classes || []).map((tc) => tc.class_id))
  return scopeClasses.some((c) => explicitClassIds.has(c.id))
}

export default function StaffDashboard() {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<StudentWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Dynamic chart data, aggregated from student_summary for whatever
  // students are currently in scope (institution-wide for Dean,
  // department-wide for HOD, assigned classes for everyone else).
  const [difficultyTotals, setDifficultyTotals] = useState<DifficultyTotals>({
    easy: 0,
    medium: 0,
    hard: 0,
  })
  const [chartLoading, setChartLoading] = useState(true)

  // Task / activity counts, scoped the same way as everything else on this
  // page: whole institution for Dean, whole department for HOD, assigned
  // class(es) for everyone else.
  const [taskCount, setTaskCount] = useState(0)
  const [activityCount, setActivityCount] = useState(0)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      // 1. Who's logged in
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError("You are not logged in. Please sign in again.")
        setLoading(false)
        return
      }

      // 2. Resolve their staff profile (role, department, etc.)
      const { data: staffRow, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (staffError) {
        setError(staffError.message)
        setLoading(false)
        return
      }

      if (!staffRow) {
        setError(
          "No staff profile is linked to this login. Ask your HOD/admin to set staff.user_id for your account."
        )
        setLoading(false)
        return
      }

      setStaff(staffRow)

      const isDean = staffRow.role === "Dean"

      let classIds: string[] = []
      let classResults: Class[] = []

      if (staffRow.role === "HOD") {
        // HOD sees every class in their own department
        const { data: deptClasses, error: classesError } = await supabase
          .from("classes")
          .select("*")
          .ilike("department", staffRow.department)
          .order("year", { ascending: true })
          .order("section", { ascending: true })

        if (classesError) {
          setError(classesError.message)
          setLoading(false)
          return
        }

        classResults = deptClasses || []
        classIds = classResults.map((c) => c.id)

        if (classResults.length === 0) {
          setError(
            `No classes found for department=${staffRow.department}. Check the \`classes\` table.`
          )
          setLoading(false)
          return
        }
      } else if (isDean) {
        // Dean sees every class across every department in the institution
        const { data: allClasses, error: classesError } = await supabase
          .from("classes")
          .select("*")
          .order("department", { ascending: true })
          .order("year", { ascending: true })
          .order("section", { ascending: true })

        if (classesError) {
          setError(classesError.message)
          setLoading(false)
          return
        }

        classResults = allClasses || []
        classIds = classResults.map((c) => c.id)
        // Note: unlike HOD, an empty class list isn't treated as a fatal
        // error for a Dean — students are still fetched directly below.
      } else {
        // Teacher / Tutor / Class Advisor: only classes they're assigned to via class_staff
        const { data: assignments, error: assignError } = await supabase
          .from("class_staff")
          .select("class_id, role, classes(*)")
          .eq("staff_id", staffRow.id)

        if (assignError) {
          setError(assignError.message)
          setLoading(false)
          return
        }

        if (!assignments || assignments.length === 0) {
          setError(
            "No class is assigned to you yet. Ask your HOD to add you in class_staff for your class."
          )
          setLoading(false)
          return
        }

        classResults = assignments
          .map((a: any) => a.classes)
          .filter(Boolean) as Class[]
        classIds = assignments.map((a: any) => a.class_id)
      }

      setClasses(classResults)

      // 3. Students in scope. A Dean's scope is the entire `students`
      //    table — no class_id filter — so every student in the database
      //    is pulled regardless of which class or department they belong to.
      let studentsQuery = supabase.from("students").select("*").order("name", { ascending: true })
      if (!isDean) {
        studentsQuery = studentsQuery.in("class_id", classIds)
      }

      const { data: studentsResult, error: studentsError } = await studentsQuery

      if (studentsError) {
        setError(studentsError.message)
        setLoading(false)
        return
      }

      const scopedStudents = studentsResult || []

      // 4. Merge in real streak + solved-count data from student_summary.
      //    This is the ONE fetch that both the chart totals AND the
      //    per-student current_streak (used by "Top Students" and the
      //    "Avg. Streak Maintained" KPI) are built from — student_summary
      //    is the only place current_streak actually lives.
      setChartLoading(true)
      const regNos = scopedStudents
        .map((s) => getRegNoFromStudent(s))
        .filter((r): r is string => Boolean(r))

      let mergedStudents: StudentWithStats[] = scopedStudents.map((s) => ({
        ...s,
        current_streak: 0,
        yesterday_streak: 0,
        easy_count: 0,
        medium_count: 0,
        hard_count: 0,
        total_solved: 0,
      }))

      if (regNos.length === 0) {
        setDifficultyTotals({ easy: 0, medium: 0, hard: 0 })
        setChartLoading(false)
      } else {
        const { data: summaryRows, error: summaryError } = await supabase
          .from("student_summary")
          .select("reg_no, easy_count, medium_count, hard_count, current_streak, yesterday_streak")
          .in("reg_no", regNos)

        if (summaryError) {
          // Non-fatal — the rest of the dashboard still works without streak/solved data
          console.error("Failed to load student_summary:", summaryError.message)
          setChartLoading(false)
        } else {
          const rows = (summaryRows as StudentSummaryRow[] | null) || []
          const summaryByRegNo = new Map(rows.map((r) => [r.reg_no, r]))

          mergedStudents = scopedStudents.map((s) => {
            const regNo = getRegNoFromStudent(s)
            const summary = summaryByRegNo.get(regNo)
            const easy = summary?.easy_count ?? 0
            const medium = summary?.medium_count ?? 0
            const hard = summary?.hard_count ?? 0
            return {
              ...s,
              current_streak: summary?.current_streak ?? 0,
              yesterday_streak: summary?.yesterday_streak ?? 0,
              easy_count: easy,
              medium_count: medium,
              hard_count: hard,
              total_solved: easy + medium + hard,
            } as StudentWithStats
          })

          const totals = rows.reduce(
            (acc, row) => {
              acc.easy += row.easy_count ?? 0
              acc.medium += row.medium_count ?? 0
              acc.hard += row.hard_count ?? 0
              return acc
            },
            { easy: 0, medium: 0, hard: 0 }
          )
          setDifficultyTotals(totals)
          setChartLoading(false)
        }
      }

      setStudents(mergedStudents)
      setLoading(false)

      // 5. Tasks + activity in scope.
      //    "In scope" = entire institution for Dean, department-wide for
      //    HOD, or targeting one of classResults for everyone else.
      setStatsLoading(true)
      let taskQuery = supabase
        .from("tasks")
        .select("id, department, target_years, applies_to_all_classes, task_classes(class_id)")
      if (!isDean) {
        taskQuery = taskQuery.ilike("department", staffRow.department)
      }

      const { data: taskRows, error: taskError } = await taskQuery

      if (taskError) {
        setTaskCount(0)
      } else {
        const scopedTasks = ((taskRows as TaskRow[] | null) || []).filter((t) =>
          isTaskInScope(t, classResults)
        )
        setTaskCount(scopedTasks.length)
      }

      // "Activity" = rows from public.activities for the class(es) in
      // scope — real activities (events, drives, sessions, etc.) that
      // staff have logged for their class, not task Q&A. For a Dean,
      // classIds already covers every class in the institution, so this
      // naturally becomes an institution-wide count with no extra branch.
      if (classIds.length === 0) {
        setActivityCount(0)
      } else {
        const { count, error: activityError } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .in("class_id", classIds)

        if (activityError) {
          console.error("Failed to load activities count:", activityError.message)
          setActivityCount(0)
        } else {
          setActivityCount(count ?? 0)
        }
      }
      setStatsLoading(false)
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <DashboardLayout userRole="Teacher" userName="Loading...">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  // Single source of truth for "what identifies this student in a URL" —
  // used consistently below instead of reaching for student.reg_no directly.
  const getRegNo = getRegNoFromStudent

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRegNo(s).toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Label shown in the header / KPI card
  const managingLabel =
    staff?.role === "Dean"
      ? `All Departments — All Students (${classes.length} classes)`
      : staff?.role === "HOD"
      ? `${staff.department} — All Sections (${classes.length} classes)`
      : classes.length === 1
      ? classes[0]?.name ||
        `${classes[0]?.department ?? ""} Y${classes[0]?.year ?? ""} ${classes[0]?.section ?? ""}`
      : classes.length > 1
      ? `${classes.length} Classes Assigned`
      : "Your Class"

  const dashboardTitle =
    staff?.role === "Dean"
      ? "Dean Dashboard"
      : staff?.role === "HOD"
      ? "HOD Dashboard"
      : staff?.role === "Class Advisor"
      ? "Class Advisor Dashboard"
      : staff?.role === "Teacher"
      ? "Teacher Dashboard"
      : "Tutor Dashboard"

  const chartScopeLabel =
    staff?.role === "Dean" ? "Institution-wide" : staff?.role === "HOD" ? "Department-wide" : "Your assigned students"

  const difficultyChartData = [
    { name: "Easy", solved: difficultyTotals.easy, fill: "#22c55e" },
    { name: "Medium", solved: difficultyTotals.medium, fill: "#eab308" },
    { name: "Hard", solved: difficultyTotals.hard, fill: "#ef4444" },
  ]
  const totalSolvedInScope = difficultyTotals.easy + difficultyTotals.medium + difficultyTotals.hard

  // Avg. Problems Solved — total solved in scope / number of students in
  // scope. Rounded to 1 decimal so small groups don't show a misleading
  // whole number.
  const avgProblemsSolved =
    students.length > 0 ? Math.round((totalSolvedInScope / students.length) * 10) / 10 : 0

  // Avg. Streak Maintained — average of each student's current_streak,
  // now correctly pulled from the merged student_summary data.
  const avgStreak =
    students.length > 0
      ? Math.round(
          (students.reduce((sum, s) => sum + (s.current_streak || 0), 0) / students.length) * 10
        ) / 10
      : 0

  const kpis = [
    {
      title:
        staff?.role === "Dean"
          ? "Total Students (All)"
          : staff?.role === "HOD"
          ? "Total Students (Dept)"
          : "Assigned Students",
      value: students.length.toString(),
      icon: Users,
      desc: managingLabel,
    },
    {
      title: "Avg. Problems Solved",
      value: chartLoading ? "…" : avgProblemsSolved.toString(),
      icon: Trophy,
      desc: chartScopeLabel,
    },
    {
      title: "Avg. Streak Maintained",
      value: chartLoading ? "…" : avgStreak.toString(),
      icon: Flame,
      desc: chartScopeLabel,
    },
    {
      title: "Tasks",
      value: statsLoading ? "…" : taskCount.toString(),
      icon: ClipboardList,
      desc:
        staff?.role === "Dean"
          ? "Across all departments"
          : staff?.role === "HOD"
          ? "Across department"
          : "Assigned to your class(es)",
    },
    {
      title: "Activity",
      value: statsLoading ? "…" : activityCount.toString(),
      icon: ActivityIcon,
      desc:
        staff?.role === "Dean"
          ? "Logged across all departments"
          : staff?.role === "HOD"
          ? "Logged across department"
          : "Logged for your class(es)",
    },
  ]

  const topStudents = [...students].sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0)).slice(0, 5)

  return (
    <DashboardLayout userRole={staff?.role || "Staff"} userName={staff?.name || "Staff"}>
      <div className="flex flex-col space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{dashboardTitle}</h1>
            <p className="text-gray-500 dark:text-gray-400">Managing {managingLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open settings">
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="sr-only">Settings</DialogTitle>
                </DialogHeader>
                <SettingsPanel onStaffUpdate={setStaff} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="py-4 text-sm text-red-600 dark:text-red-400">
              Failed to load data: {error}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((kpi, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Problems Solved by Difficulty</CardTitle>
              <CardDescription>
                {chartScopeLabel} · {totalSolvedInScope} total solved
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : totalSolvedInScope === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No LeetCode progress recorded yet for this group.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={difficultyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="solved" radius={[4, 4, 0, 0]}>
                      {difficultyChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Top Students</CardTitle>
              <CardDescription>Ranked by current streak</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topStudents.map((student, idx) => {
                  const regNo = getRegNo(student)
                  const rowContent = (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs dark:bg-blue-900 dark:text-blue-300">
                        #{idx + 1}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium leading-none truncate text-gray-900 dark:text-gray-100">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{regNo}</p>
                        {(staff?.role === "HOD" || staff?.role === "Dean") && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {student.department} / Y{student.year} / {student.section}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-medium text-orange-500">
                        <Trophy className="h-3 w-3" />
                        <span>{student.current_streak || 0}</span>
                      </div>
                    </>
                  )

                  return regNo ? (
                    <Link
                      key={student.id || regNo}
                      href={`/dashboard/student/${regNo}`}
                      className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div key={student.id || regNo} className="flex items-center gap-3 -mx-2 px-2 py-1">
                      {rowContent}
                    </div>
                  )
                })}
                {topStudents.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No students available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {staff?.role === "Dean"
                  ? "All Students"
                  : staff?.role === "HOD"
                  ? "All Department Students"
                  : "Assigned Students"}
              </CardTitle>
              <CardDescription>
                {staff?.role === "Dean"
                  ? "View and manage across the entire institution"
                  : staff?.role === "HOD"
                  ? "View and manage across all sections"
                  : "Manage and review your class"}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                type="search"
                placeholder="Search students..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Dept / Year / Section</TableHead>
                  <TableHead>LeetCode</TableHead>
                  <TableHead>GitHub</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const regNo = getRegNo(student)
                  return (
                    <TableRow key={student.id || regNo}>
                      <TableCell className="font-medium">{regNo}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        {student.department} / Y{student.year} / {student.section}
                      </TableCell>
                      <TableCell>
                        {student.leetcode_username ? (
                          <a
                            href={`https://leetcode.com/u/${student.leetcode_username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {student.leetcode_username}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.github_link && student.github_link !== "link" ? (
                          <a
                            href={student.github_link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Profile
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {regNo ? (
                          <Link href={`/dashboard/student/${regNo}`}>
                            <Button variant="outline" size="sm">
                              View Profile
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="outline" size="sm" disabled title="Missing registration number">
                            View Profile
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                      No students found for your account. Please verify your class_staff assignment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}