"use client"

import { useEffect, useMemo, useState } from "react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Search,
  Loader2,
  ExternalLink,
  Trophy,
  Filter,
  Download,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Student, Class } from "@/types"
import * as XLSX from "xlsx"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
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
  role: "HOD" | "Teacher" | "Tutor" | "Class Advisor"
  department: string
  year: number | null
  section: string | null
  user_id: string | null
}

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

// Student row enriched with stats merged in from student_summary
type StudentWithStats = Student & {
  current_streak?: number
  yesterday_streak?: number
  easy_count?: number
  medium_count?: number
  hard_count?: number
  total_solved?: number
}

type LinkFilter = "all" | "leetcode" | "github" | "none"

// Ranking-based filters. Rather than a fixed numeric threshold (e.g.
// "solved >= 10"), "top" / "least" carve off a relative slice of whoever
// is currently in view, ranked by the metric in question. This way the
// filter stays meaningful whether you're looking at 8 students or 800 —
// there's no magic number to keep tuned as the data changes.
type RankFilter = "all" | "top" | "least"

// Accumulator shape used while building the Class Performance chart data.
// Pulled out as a named interface (rather than an inline object type on
// the Map generic) to keep that generic declaration simple.
interface ChartGroupAccumulator {
  groupLabel: string
  totalEasy: number
  totalMedium: number
  totalHard: number
  studentCount: number
}

const getRegNoFromStudent = (s: Student) => s.reg_no || s.register_number || ""
const getStudentKey = (s: StudentWithStats) => s.id || getRegNoFromStudent(s)

const ALL_VALUE = "all"

// The fraction of the current pool that counts as "top" or "least".
// Not a data threshold — a ranking cutoff, recomputed against whatever
// students are currently in view.
const RANK_SLICE = 0.25

/**
 * Given a pool of students and a metric, returns the set of student keys
 * that fall in the top slice or bottom slice by that metric. Ties at the
 * cutoff are all included (so the slice may be slightly larger than exactly
 * 25%), and on very small pools it always returns at least one student
 * rather than rounding down to zero.
 */
function getRankSet(
  pool: StudentWithStats[],
  metric: (s: StudentWithStats) => number,
  mode: "top" | "least"
): Set<string> {
  if (pool.length === 0) return new Set()

  const sorted = [...pool].sort((a, b) => metric(b) - metric(a))
  const cutoffCount = Math.max(1, Math.ceil(sorted.length * RANK_SLICE))

  if (mode === "top") {
    const cutoffValue = metric(sorted[cutoffCount - 1])
    return new Set(sorted.filter((s) => metric(s) >= cutoffValue).map(getStudentKey))
  }

  // "least" — bottom slice, i.e. worst performers / lowest values
  const bottomSorted = [...pool].sort((a, b) => metric(a) - metric(b))
  const cutoffValue = metric(bottomSorted[cutoffCount - 1])
  return new Set(bottomSorted.filter((s) => metric(s) <= cutoffValue).map(getStudentKey))
}

export default function DepartmentStudentsPage() {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<StudentWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search + filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [yearFilter, setYearFilter] = useState<string>(ALL_VALUE)
  const [classFilter, setClassFilter] = useState<string>(ALL_VALUE) // class id, replaces old section filter
  const [linkFilter, setLinkFilter] = useState<LinkFilter>(ALL_VALUE as LinkFilter)
  const [solvedRank, setSolvedRank] = useState<RankFilter>("all") // "high coding" ranking
  const [hardRank, setHardRank] = useState<RankFilter>("all") // "high hard problems" ranking
  const [streakRank, setStreakRank] = useState<RankFilter>("all") // streak high/low ranking
  const [filterOpen, setFilterOpen] = useState(false)

  // Top ranking dialog
  const [rankingOpen, setRankingOpen] = useState(false)

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

      // 2. Resolve their staff profile — we only need the department here,
      //    since this page shows every student in that department
      //    regardless of which classes this staff member is assigned to.
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

      // 3. Every class in this department (used to populate the Year /
      //    Class filter options), not just classes this staff is
      //    assigned to.
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

      setClasses(deptClasses || [])

      // 4. Every student in this department — the whole point of this page.
      const { data: studentsResult, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .ilike("department", staffRow.department)
        .order("name", { ascending: true })

      if (studentsError) {
        setError(studentsError.message)
        setLoading(false)
        return
      }

      const scopedStudents = studentsResult || []

      // 5. Merge in real streak + solved-count data from student_summary.
      const regNos = scopedStudents
        .map((s) => getRegNoFromStudent(s))
        .filter((r): r is string => Boolean(r))

      let mergedStudents: StudentWithStats[] = scopedStudents

      if (regNos.length > 0) {
        const { data: summaryRows, error: summaryError } = await supabase
          .from("student_summary")
          .select("reg_no, easy_count, medium_count, hard_count, current_streak, yesterday_streak")
          .in("reg_no", regNos)

        if (summaryError) {
          console.error("Failed to load student_summary:", summaryError.message)
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
        }
      }

      setStudents(mergedStudents)
      setLoading(false)
    }

    loadData()
  }, [])

  const getRegNo = getRegNoFromStudent

  // Distinct years available in this department, for the Year filter
  const years = useMemo(
    () => Array.from(new Set(classes.map((c) => c.year).filter((y): y is number => y != null))).sort(
      (a, b) => a - b
    ),
    [classes]
  )

  const classLabel = (c: Class) => c.name || `Y${c.year} · Section ${c.section}`

  // Classes available for the Class dropdown — narrowed to the selected
  // year, or every class in the department if "All years" is picked.
  const classesForYear = useMemo(
    () => (yearFilter === ALL_VALUE ? classes : classes.filter((c) => String(c.year) === yearFilter)),
    [classes, yearFilter]
  )

  // Reset the class filter if it's no longer valid for the selected year
  useEffect(() => {
    if (classFilter !== ALL_VALUE && !classesForYear.some((c) => c.id === classFilter)) {
      setClassFilter(ALL_VALUE)
    }
  }, [classesForYear, classFilter])

  const activeFilterCount =
    (yearFilter !== ALL_VALUE ? 1 : 0) +
    (classFilter !== ALL_VALUE ? 1 : 0) +
    (linkFilter !== ALL_VALUE ? 1 : 0) +
    (solvedRank !== "all" ? 1 : 0) +
    (hardRank !== "all" ? 1 : 0) +
    (streakRank !== "all" ? 1 : 0)

  const clearFilters = () => {
    setYearFilter(ALL_VALUE)
    setClassFilter(ALL_VALUE)
    setLinkFilter(ALL_VALUE as LinkFilter)
    setSolvedRank("all")
    setHardRank("all")
    setStreakRank("all")
  }

  const matchesBaseFilters = (s: StudentWithStats) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRegNo(s).toLowerCase().includes(searchTerm.toLowerCase())

    const matchesYear = yearFilter === ALL_VALUE || String(s.year) === yearFilter

    const selectedClass = classFilter === ALL_VALUE ? null : classes.find((c) => c.id === classFilter)
    const matchesClass = !selectedClass || (s.year === selectedClass.year && s.section === selectedClass.section)

    const hasLeetcode = Boolean(s.leetcode_username)
    const hasGithub = Boolean(s.github_link && s.github_link !== "link")
    const matchesLink =
      linkFilter === ALL_VALUE ||
      (linkFilter === "leetcode" && hasLeetcode) ||
      (linkFilter === "github" && hasGithub) ||
      (linkFilter === "none" && !hasLeetcode && !hasGithub)

    return matchesSearch && matchesYear && matchesClass && matchesLink
  }

  // Pool the ranking filters are computed against: everyone who passes
  // search / year / class / link filters. Ranking is relative to THIS
  // pool, so e.g. "Top" solved re-ranks itself when you narrow to a
  // single class.
  const basePool = useMemo(() => students.filter(matchesBaseFilters), [
    students,
    searchTerm,
    yearFilter,
    classFilter,
    linkFilter,
    classes,
  ])

  const solvedRankSet = useMemo(
    () => (solvedRank === "all" ? null : getRankSet(basePool, (s) => s.total_solved ?? 0, solvedRank)),
    [basePool, solvedRank]
  )
  const hardRankSet = useMemo(
    () => (hardRank === "all" ? null : getRankSet(basePool, (s) => s.hard_count ?? 0, hardRank)),
    [basePool, hardRank]
  )
  const streakRankSet = useMemo(
    () => (streakRank === "all" ? null : getRankSet(basePool, (s) => s.current_streak ?? 0, streakRank)),
    [basePool, streakRank]
  )

  const filteredStudents = basePool.filter((s) => {
    const key = getStudentKey(s)
    if (solvedRankSet && !solvedRankSet.has(key)) return false
    if (hardRankSet && !hardRankSet.has(key)) return false
    if (streakRankSet && !streakRankSet.has(key)) return false
    return true
  })

  // Which year's leaderboard the Top Ranking dialog shows. If the person
  // has picked a specific year in the Filters popover, honor that. If not
  // (year filter is "All years"), default to the senior-most year: Year 4
  // if the department has one, otherwise Year 3, otherwise just the
  // highest year that actually exists.
  const defaultRankingYear = useMemo(() => {
    if (years.includes(4)) return 4
    if (years.includes(3)) return 3
    return years.length > 0 ? years[years.length - 1] : null
  }, [years])

  const rankingYear = yearFilter !== ALL_VALUE ? Number(yearFilter) : defaultRankingYear

  const topRanked = useMemo(() => {
    const pool = rankingYear != null ? students.filter((s) => s.year === rankingYear) : students
    return [...pool].sort((a, b) => (b.total_solved || 0) - (a.total_solved || 0)).slice(0, 10)
  }, [students, rankingYear])

  const managingLabel = staff ? `${staff.department} — All Sections (${classes.length} classes)` : ""

  const kpis = staff
    ? [
        {
          title: "Total Students (Dept)",
          value: students.length.toString(),
          icon: Users,
          desc: managingLabel,
        },
        {
          title: "Avg. Streak",
          value:
            students.length > 0
              ? Math.round(
                  students.reduce((sum, s) => sum + (s.current_streak || 0), 0) / students.length
                ).toString()
              : "0",
          icon: Trophy,
          desc: "Across department",
        },
      ]
    : []

  // Which class/year is performing best. When "All years" is selected in
  // the filter, group by year (Y1, Y2, Y3...) so you can compare years at
  // a glance. Once a specific year is picked, drill down and group by
  // section within that year (Y3 A, Y3 B, Y3 C...) instead. Each bar is
  // stacked from the group's average Easy / Medium / Hard solved per
  // student. Ignores the free-text search and the ranking filters — this
  // chart is for comparing groups, not showing whoever the ranking picked.
  const studentsForChart = students.filter((s) => {
    const matchesYear = yearFilter === ALL_VALUE || String(s.year) === yearFilter
    const selectedClass = classFilter === ALL_VALUE ? null : classes.find((c) => c.id === classFilter)
    const matchesClass = !selectedClass || (s.year === selectedClass.year && s.section === selectedClass.section)

    const hasLeetcode = Boolean(s.leetcode_username)
    const hasGithub = Boolean(s.github_link && s.github_link !== "link")
    const matchesLink =
      linkFilter === ALL_VALUE ||
      (linkFilter === "leetcode" && hasLeetcode) ||
      (linkFilter === "github" && hasGithub) ||
      (linkFilter === "none" && !hasLeetcode && !hasGithub)

    return matchesYear && matchesClass && matchesLink
  })

  const chartGroupedByYear = yearFilter === ALL_VALUE

  const classPerformance = useMemo(() => {
    const map = new Map<string, ChartGroupAccumulator>()

    studentsForChart.forEach((s) => {
      const groupLabel = chartGroupedByYear
        ? `Y${s.year ?? "?"}`
        : s.section
        ? `Y${s.year ?? "?"} ${s.section}`
        : `Y${s.year ?? "?"}`

      const entry =
        map.get(groupLabel) || { groupLabel, totalEasy: 0, totalMedium: 0, totalHard: 0, studentCount: 0 }
      entry.totalEasy += s.easy_count ?? 0
      entry.totalMedium += s.medium_count ?? 0
      entry.totalHard += s.hard_count ?? 0
      entry.studentCount += 1
      map.set(groupLabel, entry)
    })

    return Array.from(map.values())
      .map((entry) => {
        const avgEasy = entry.studentCount > 0 ? Math.round((entry.totalEasy / entry.studentCount) * 10) / 10 : 0
        const avgMedium =
          entry.studentCount > 0 ? Math.round((entry.totalMedium / entry.studentCount) * 10) / 10 : 0
        const avgHard = entry.studentCount > 0 ? Math.round((entry.totalHard / entry.studentCount) * 10) / 10 : 0
        return {
          groupLabel: entry.groupLabel,
          avgEasy,
          avgMedium,
          avgHard,
          totalAvg: Math.round((avgEasy + avgMedium + avgHard) * 10) / 10,
        }
      })
      // Sort by group label when grouped by year (Y1, Y2, Y3...) so it
      // reads naturally left-to-right instead of by performance.
      .sort((a, b) =>
        chartGroupedByYear ? a.groupLabel.localeCompare(b.groupLabel) : b.totalAvg - a.totalAvg
      )
  }, [studentsForChart, chartGroupedByYear])

  // Build an Excel workbook of the currently filtered students and trigger
  // a download. Purely client-side via SheetJS — no server round trip
  // needed for this.
  const exportToExcel = () => {
    const headers = [
      "Reg No",
      "Name",
      "Department",
      "Year",
      "Section",
      "LeetCode Username",
      "GitHub Link",
      "Current Streak",
      "Total Solved",
      "Easy Solved",
      "Medium Solved",
      "Hard Solved",
    ]

    const rows = filteredStudents.map((s) => [
      getRegNo(s),
      s.name,
      s.department,
      s.year,
      s.section,
      s.leetcode_username || "",
      s.github_link && s.github_link !== "link" ? s.github_link : "",
      s.current_streak ?? 0,
      s.total_solved ?? 0,
      s.easy_count ?? 0,
      s.medium_count ?? 0,
      s.hard_count ?? 0,
    ])

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // A few reasonable column widths so the sheet is readable without
    // manual resizing.
    worksheet["!cols"] = [
      { wch: 14 }, // Reg No
      { wch: 22 }, // Name
      { wch: 14 }, // Department
      { wch: 6 }, // Year
      { wch: 9 }, // Section
      { wch: 20 }, // LeetCode Username
      { wch: 28 }, // GitHub Link
      { wch: 12 }, // Current Streak
      { wch: 12 }, // Total Solved
      { wch: 10 }, // Easy Solved
      { wch: 12 }, // Medium Solved
      { wch: 10 }, // Hard Solved
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students")

    const deptSlug = (staff?.department || "department").toLowerCase().replace(/\s+/g, "-")
    XLSX.writeFile(workbook, `${deptSlug}-students-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (loading) {
    return (
      <DashboardLayout userRole={staff?.role || "Staff"} userName={staff?.name || "Loading..."}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userRole={staff?.role || "Staff"} userName={staff?.name || "Staff"}>
      <div className="flex flex-col space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Department Students</h1>
            <p className="text-gray-500 dark:text-gray-400">Managing {managingLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter button */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-4" align="end">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filter students</p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Year</label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>All years</SelectItem>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          Year {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Class</label>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>All classes</SelectItem>
                      {classesForYear.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {classLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Linked profiles
                  </label>
                  <Select value={linkFilter} onValueChange={(v) => setLinkFilter(v as LinkFilter)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>All students</SelectItem>
                      <SelectItem value="leetcode">LeetCode linked</SelectItem>
                      <SelectItem value="github">GitHub linked</SelectItem>
                      <SelectItem value="none">No profiles linked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-3 space-y-3 dark:border-gray-800">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Ranking (relative to students currently shown)
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Problems solved</label>
                    <Select value={solvedRank} onValueChange={(v) => setSolvedRank(v as RankFilter)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="top">Top (high coding)</SelectItem>
                        <SelectItem value="least">Least (very low)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Hard problems solved</label>
                    <Select value={hardRank} onValueChange={(v) => setHardRank(v as RankFilter)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="top">Top (high hard)</SelectItem>
                        <SelectItem value="least">Least (very low)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Streak</label>
                    <Select value={streakRank} onValueChange={(v) => setStreakRank(v as RankFilter)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="top">Top (high streak)</SelectItem>
                        <SelectItem value="least">Least (very low)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Top ranking button */}
            <Dialog open={rankingOpen} onOpenChange={setRankingOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Trophy className="h-4 w-4 text-orange-500" />
                  Top Ranking
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Top 10 Students{rankingYear != null ? ` — Year ${rankingYear}` : ""}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {topRanked.map((student, idx) => (
                    <div
                      key={student.id || getRegNo(student) || `top-${idx}`}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-2 dark:border-gray-800"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                          idx === 0
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            : idx === 1
                            ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                            : idx === 2
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium leading-none truncate text-gray-900 dark:text-gray-100">
                          {student.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {getRegNo(student)} · Y{student.year} {student.section}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{student.total_solved ?? 0} solved</p>
                        <p className="flex items-center justify-end gap-1 text-xs text-orange-500">
                          <Trophy className="h-3 w-3" />
                          {student.current_streak ?? 0} streak
                        </p>
                      </div>
                    </div>
                  ))}
                  {topRanked.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No students available{rankingYear != null ? ` for Year ${rankingYear}` : ""}
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Export button */}
            <Button variant="outline" size="sm" className="gap-2" onClick={exportToExcel}>
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="py-4 text-sm text-red-600 dark:text-red-400">
              Failed to load data: {error}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards + Class Performance */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="grid gap-4 lg:col-span-1">
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

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Class Performance</CardTitle>
              <CardDescription>
                Avg. Easy / Medium / Hard solved per student
                {chartGroupedByYear ? ", by year" : `, by section (Year ${yearFilter})`}
                {classFilter !== ALL_VALUE || linkFilter !== ALL_VALUE ? " (filtered)" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classPerformance.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No LeetCode progress recorded yet for this department.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={classPerformance} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                    <XAxis dataKey="groupLabel" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="avgEasy" name="Easy" stackId="difficulty" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar
                      dataKey="avgMedium"
                      name="Medium"
                      stackId="difficulty"
                      fill="#eab308"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar dataKey="avgHard" name="Hard" stackId="difficulty" fill="#ef4444" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="totalAvg" position="top" style={{ fontSize: 11, fill: "currentColor" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>All Department Students</CardTitle>
              <CardDescription>
                {filteredStudents.length} of {students.length} students shown
                {(solvedRank !== "all" || hardRank !== "all" || streakRank !== "all") && " · ranking applied"}
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
                  <TableHead>Streak</TableHead>
                  <TableHead>Hard Solved</TableHead>
                  <TableHead>Total Solved</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student, idx) => {
                  const regNo = getRegNo(student)
                  return (
                    <TableRow key={student.id || regNo || `row-${idx}`}>
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
                      <TableCell>
                        <span className="flex items-center gap-1 font-medium text-orange-500">
                          <Trophy className="h-3 w-3" />
                          {student.current_streak ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>{student.hard_count ?? 0}</TableCell>
                      <TableCell>{student.total_solved ?? 0}</TableCell>
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
                    <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                      No students match your search/filters.
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