"use client"

import { useMemo, useState, useEffect } from "react"
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

// Sort-direction selects. These reorder the visible list only -- they
// never hide anyone. Every student that passes the base filters
// (search/dept/year/class) stays visible, just in a different order.
type RankFilter = "all" | "top" | "least"

// Accumulator shape used while building the Class Performance chart data.
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

export default function DepartmentStudentsPage() {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<StudentWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search + filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [yearFilter, setYearFilter] = useState<string>(ALL_VALUE)
  const [classFilter, setClassFilter] = useState<string>(ALL_VALUE) // class id
  const [deptFilter, setDeptFilter] = useState<string>(ALL_VALUE) // department name
  const [solvedRank, setSolvedRank] = useState<RankFilter>("all") // sort by problems solved
  const [hardRank, setHardRank] = useState<RankFilter>("all") // sort by hard problems solved
  const [streakRank, setStreakRank] = useState<RankFilter>("all") // sort by streak
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

      // 2. Resolve their staff profile
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

      // 3. Every class (across all departments) -- the Department filter
      //    lets the user narrow this down client-side.
      const { data: allClasses, error: classesError } = await supabase
        .from("classes")
        .select("*")
        .order("year", { ascending: true })
        .order("section", { ascending: true })

      if (classesError) {
        setError(classesError.message)
        setLoading(false)
        return
      }

      setClasses(allClasses || [])

      // 4. Every student (across all departments), ordered by reg_no by
      //    default so the list has a stable, predictable base order
      //    before any search/filter/sort is applied.
      const { data: studentsResult, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .order("reg_no", { ascending: true })

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

  // Distinct departments available, for the Department filter
  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          classes
            .map((c) => (c as Class & { department?: string }).department)
            .filter((d): d is string => Boolean(d))
        )
      ).sort(),
    [classes]
  )

  // Distinct years available, for the Year filter (narrowed to the
  // selected department if one is picked)
  const years = useMemo(() => {
    const scoped =
      deptFilter === ALL_VALUE
        ? classes
        : classes.filter((c) => (c as Class & { department?: string }).department === deptFilter)
    return Array.from(new Set(scoped.map((c) => c.year).filter((y): y is number => y != null))).sort(
      (a, b) => a - b
    )
  }, [classes, deptFilter])

  const classLabel = (c: Class) => c.name || `Y${c.year} - Section ${c.section}`

  // Classes available for the Class dropdown -- narrowed to the selected
  // department and year.
  const classesForYear = useMemo(
    () =>
      classes.filter((c) => {
        const matchesDept =
          deptFilter === ALL_VALUE || (c as Class & { department?: string }).department === deptFilter
        const matchesYear = yearFilter === ALL_VALUE || String(c.year) === yearFilter
        return matchesDept && matchesYear
      }),
    [classes, deptFilter, yearFilter]
  )

  // Derived, not stored -- avoids a "setState in an effect" round trip.
  const effectiveClassFilter = useMemo(() => {
    if (classFilter === ALL_VALUE) return ALL_VALUE
    return classesForYear.some((c) => c.id === classFilter) ? classFilter : ALL_VALUE
  }, [classFilter, classesForYear])

  const activeFilterCount =
    (deptFilter !== ALL_VALUE ? 1 : 0) +
    (yearFilter !== ALL_VALUE ? 1 : 0) +
    (effectiveClassFilter !== ALL_VALUE ? 1 : 0) +
    (solvedRank !== "all" ? 1 : 0) +
    (hardRank !== "all" ? 1 : 0) +
    (streakRank !== "all" ? 1 : 0)

  const clearFilters = () => {
    setDeptFilter(ALL_VALUE)
    setYearFilter(ALL_VALUE)
    setClassFilter(ALL_VALUE)
    setSolvedRank("all")
    setHardRank("all")
    setStreakRank("all")
  }

  const matchesBaseFilters = (s: StudentWithStats) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRegNo(s).toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDept = deptFilter === ALL_VALUE || s.department === deptFilter

    const matchesYear = yearFilter === ALL_VALUE || String(s.year) === yearFilter

    const selectedClass =
      effectiveClassFilter === ALL_VALUE ? null : classes.find((c) => c.id === effectiveClassFilter)
    const matchesClass = !selectedClass || (s.year === selectedClass.year && s.section === selectedClass.section)

    return matchesSearch && matchesDept && matchesYear && matchesClass
  }

  // Everyone who passes search / dept / year / class filters. This is the
  // full visible set -- sorting below never removes anyone from it.
  const basePool = useMemo(() => students.filter(matchesBaseFilters), [
    students,
    searchTerm,
    deptFilter,
    yearFilter,
    effectiveClassFilter,
    classes,
  ])

  // Sort the base pool by whichever ranking selects are active, without
  // dropping any student.
  //
  // Previously this used a fixed priority chain (Problems solved, then
  // Hard, then Streak) where later keys only broke ties in the earlier
  // ones. Since total_solved values are almost always unique, the later
  // keys effectively never ran -- picking "Streak" alongside "Problems
  // solved" had no visible effect.
  //
  // Instead, each active key now contributes a RANK POSITION (1 = best
  // for that metric, given its own top/least direction), and a student's
  // final order is by the AVERAGE of their ranks across every active key.
  // That way two selected criteria are blended together -- someone who
  // scores well on both selected metrics rises above someone who only
  // dominates one of them.
  const filteredStudents = useMemo(() => {
    const activeKeys: { mode: RankFilter; metric: (s: StudentWithStats) => number }[] = [
      { mode: solvedRank, metric: (s) => s.total_solved ?? 0 },
      { mode: hardRank, metric: (s) => s.hard_count ?? 0 },
      { mode: streakRank, metric: (s) => s.current_streak ?? 0 },
    ].filter((k) => k.mode !== "all")

    if (activeKeys.length === 0) {
      // No ranking sort active -- fall back to reg_no order so the list
      // stays predictable rather than whatever order the data happened
      // to load in.
      return [...basePool].sort((a, b) => getRegNo(a).localeCompare(getRegNo(b), undefined, { numeric: true }))
    }

    // Build a rank-position map (student key -> 1-based rank) for one
    // metric/direction, computed over the current basePool only.
    const buildRankMap = (metric: (s: StudentWithStats) => number, mode: RankFilter) => {
      const sorted = [...basePool].sort((a, b) =>
        mode === "top" ? metric(b) - metric(a) : metric(a) - metric(b)
      )
      const map = new Map<string, number>()
      sorted.forEach((s, idx) => map.set(getStudentKey(s), idx + 1))
      return map
    }

    const rankMaps = activeKeys.map(({ metric, mode }) => buildRankMap(metric, mode))

    const averageRank = (s: StudentWithStats) => {
      const key = getStudentKey(s)
      const total = rankMaps.reduce((sum, map) => sum + (map.get(key) ?? Number.MAX_SAFE_INTEGER), 0)
      return total / rankMaps.length
    }

    return [...basePool].sort((a, b) => averageRank(a) - averageRank(b))
  }, [basePool, solvedRank, hardRank, streakRank])

  // Which year's leaderboard the Top Ranking dialog shows.
  const defaultRankingYear = useMemo(() => {
    if (years.includes(4)) return 4
    if (years.includes(3)) return 3
    return years.length > 0 ? years[years.length - 1] : null
  }, [years])

  const rankingYear = yearFilter !== ALL_VALUE ? Number(yearFilter) : defaultRankingYear

  const topRanked = useMemo(() => {
    let pool = students
    if (deptFilter !== ALL_VALUE) pool = pool.filter((s) => s.department === deptFilter)
    if (rankingYear != null) pool = pool.filter((s) => s.year === rankingYear)
    return [...pool].sort((a, b) => (b.total_solved || 0) - (a.total_solved || 0)).slice(0, 10)
  }, [students, deptFilter, rankingYear])

  const managingLabel = staff
    ? deptFilter === ALL_VALUE
      ? `All Departments (${classes.length} classes)`
      : `${deptFilter} -- All Sections (${classesForYear.length} classes)`
    : ""

  const kpis = staff
    ? [
        {
          title: "Total Students",
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
          desc: "Across all students",
        },
      ]
    : []

  // Which class/year is performing best. Ignores search + ranking sort --
  // this chart is for comparing groups.
  const studentsForChart = students.filter((s) => {
    const matchesDept = deptFilter === ALL_VALUE || s.department === deptFilter
    const matchesYear = yearFilter === ALL_VALUE || String(s.year) === yearFilter
    const selectedClass =
      effectiveClassFilter === ALL_VALUE ? null : classes.find((c) => c.id === effectiveClassFilter)
    const matchesClass = !selectedClass || (s.year === selectedClass.year && s.section === selectedClass.section)

    return matchesDept && matchesYear && matchesClass
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
      .sort((a, b) =>
        chartGroupedByYear ? a.groupLabel.localeCompare(b.groupLabel) : b.totalAvg - a.totalAvg
      )
  }, [studentsForChart, chartGroupedByYear])

  // Build an Excel workbook of the currently shown students and trigger a
  // download. Purely client-side via SheetJS.
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

    const deptSlug = (deptFilter !== ALL_VALUE ? deptFilter : staff?.department || "department")
      .toLowerCase()
      .replace(/\s+/g, "-")
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
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>All departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    value={effectiveClassFilter}
                    onValueChange={setClassFilter}
                  >
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

                <div className="border-t pt-3 space-y-3 dark:border-gray-800">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Sort by (all students still shown)
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Problems solved</label>
                    <Select value={solvedRank} onValueChange={(v) => setSolvedRank(v as RankFilter)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="No sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">No sort</SelectItem>
                        <SelectItem value="top">Highest first</SelectItem>
                        <SelectItem value="least">Lowest first</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Hard problems solved</label>
                    <Select value={hardRank} onValueChange={(v) => setHardRank(v as RankFilter)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="No sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">No sort</SelectItem>
                        <SelectItem value="top">Highest first</SelectItem>
                        <SelectItem value="least">Lowest first</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Streak</label>
                    <Select value={streakRank} onValueChange={(v) => setStreakRank(v as RankFilter)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="No sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">No sort</SelectItem>
                        <SelectItem value="top">Highest first</SelectItem>
                        <SelectItem value="least">Lowest first</SelectItem>
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
                    Top 10 Students{rankingYear != null ? ` -- Year ${rankingYear}` : ""}
                    {deptFilter !== ALL_VALUE ? ` (${deptFilter})` : ""}
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
                          {getRegNo(student)} - Y{student.year} {student.section}
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
                {effectiveClassFilter !== ALL_VALUE || deptFilter !== ALL_VALUE ? " (filtered)" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classPerformance.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No LeetCode progress recorded yet.
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
                {(solvedRank !== "all" || hardRank !== "all" || streakRank !== "all") && " - sorted"}
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
                  <TableHead>Easy Solved</TableHead>
                  <TableHead>Medium Solved</TableHead>
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
                      <TableCell>{student.easy_count ?? 0}</TableCell>
                      <TableCell>{student.medium_count ?? 0}</TableCell>
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
                    <TableCell colSpan={11} className="text-center py-6 text-gray-500">
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