"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Loader2, ExternalLink, Trophy, FileDown, FileSpreadsheet, Link2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { exportStudentsToExcel, exportStudentsToPDF } from "@/lib/export-utils"
import { Class } from "@/types"

// Row shape of public.student_summary
type StudentSummary = {
  reg_no: string
  easy_count: number | null
  medium_count: number | null
  hard_count: number | null
  current_streak: number | null
  yesterday_streak: number | null
  updated_at: string | null
}

// Raw row returned by: students.select("*, student_summary(*)")
type StudentRow = {
  id: string
  reg_no: string
  name: string
  department: string
  year: number
  section: string
  leetcode_username: string | null
  github_link: string | null
  class_id: string
  // Supabase returns an array for a to-many embed even though the FK is 1:1 here
  student_summary: StudentSummary | StudentSummary[] | null
}

export type StudentWithSummary = StudentRow & {
  easy_count: number
  medium_count: number
  hard_count: number
  current_streak: number
  total_solved: number
}

// Sort-direction selects. These only reorder the visible list -- they
// never hide anyone. Every student that passes search/LeetCode-linked
// filters stays visible, just in a different order.
type RankFilter = "all" | "top" | "least"

const getStudentKey = (s: StudentWithSummary) => s.id || s.reg_no

interface ClassDetailPanelProps {
  classInfo: Class
}

export default function ClassDetailPanel({ classInfo }: ClassDetailPanelProps) {
  const [students, setStudents] = useState<StudentWithSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [leetcodeOnly, setLeetcodeOnly] = useState(false)

  // Replaces the old single-select "Sort by Easy/Medium/Hard/Streak"
  // toggle buttons. Each of these can be set independently, and -- unlike
  // a plain toggle -- more than one can be active at once.
  const [solvedRank, setSolvedRank] = useState<RankFilter>("all") // sort by total problems solved
  const [hardRank, setHardRank] = useState<RankFilter>("all") // sort by hard problems solved
  const [streakRank, setStreakRank] = useState<RankFilter>("all") // sort by streak

  // classId is derived once per render and used as the sole effect
  // dependency below. Kept as a plain string (never an array/object
  // literal) so the dependency list is always length-1 and order-stable
  // across renders -- this is what keeps React's hook-order check happy
  // even across Fast Refresh / remounts.
  const classId = classInfo.id

  useEffect(() => {
    let isMounted = true

    async function loadStudents() {
      setLoading(true)
      setError(null)
      const supabase = createClient()

      // FK student_summary.reg_no -> students.reg_no lets PostgREST embed it in one call
      const { data, error: fetchError } = await supabase
        .from("students")
        .select("*, student_summary(*)")
        .eq("class_id", classId)
        .order("name", { ascending: true })

      if (!isMounted) return

      if (fetchError) {
        setError(fetchError.message)
        setStudents([])
        setLoading(false)
        return
      }

      const normalized: StudentWithSummary[] = (data || []).map((row: any) => {
        const summary: StudentSummary | null = Array.isArray(row.student_summary)
          ? row.student_summary[0] || null
          : row.student_summary || null

        const easy = summary?.easy_count ?? 0
        const medium = summary?.medium_count ?? 0
        const hard = summary?.hard_count ?? 0

        return {
          ...row,
          easy_count: easy,
          medium_count: medium,
          hard_count: hard,
          current_streak: summary?.current_streak ?? 0,
          total_solved: easy + medium + hard,
        }
      })

      setStudents(normalized)
      setLoading(false)
    }

    loadStudents()
    return () => {
      isMounted = false
    }
  }, [classId])

  const topThree = useMemo(
    () => [...students].sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0)).slice(0, 3),
    [students]
  )

  // Search + LeetCode-linked filter only. This is the full visible set --
  // sorting below never removes anyone from it.
  const basePool = useMemo(() => {
    let list = students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.reg_no.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (leetcodeOnly) {
      list = list.filter((s) => !!s.leetcode_username)
    }

    return list
  }, [students, searchTerm, leetcodeOnly])

  // Sort the base pool by whichever ranking selects are active, without
  // dropping any student. Each active key contributes a RANK POSITION
  // (1 = best for that metric, given its own top/least direction), and a
  // student's final order is by the AVERAGE of their ranks across every
  // active key. That way two selected criteria blend together -- a
  // student strong on both selected metrics rises above one who only
  // dominates a single metric.
  const visibleStudents = useMemo(() => {
    const activeKeys: { mode: RankFilter; metric: (s: StudentWithSummary) => number }[] = [
      { mode: solvedRank, metric: (s) => s.total_solved },
      { mode: hardRank, metric: (s) => s.hard_count },
      { mode: streakRank, metric: (s) => s.current_streak },
    ].filter((k) => k.mode !== "all")

    if (activeKeys.length === 0) return basePool

    const buildRankMap = (metric: (s: StudentWithSummary) => number, mode: RankFilter) => {
      const sorted = [...basePool].sort((a, b) =>
        mode === "top" ? metric(b) - metric(a) : metric(a) - metric(b)
      )
      const map = new Map<string, number>()
      sorted.forEach((s, idx) => map.set(getStudentKey(s), idx + 1))
      return map
    }

    const rankMaps = activeKeys.map(({ metric, mode }) => buildRankMap(metric, mode))

    const averageRank = (s: StudentWithSummary) => {
      const key = getStudentKey(s)
      const total = rankMaps.reduce((sum, map) => sum + (map.get(key) ?? Number.MAX_SAFE_INTEGER), 0)
      return total / rankMaps.length
    }

    return [...basePool].sort((a, b) => averageRank(a) - averageRank(b))
  }, [basePool, solvedRank, hardRank, streakRank])

  const className = classInfo.name || `${classInfo.department} Y${classInfo.year} ${classInfo.section}`

  const handleExportPDF = () => {
    exportStudentsToPDF(visibleStudents, `${className} - Student Report`, className.replace(/\s+/g, "_"))
  }

  const handleExportExcel = () => {
    exportStudentsToExcel(visibleStudents, className.replace(/\s+/g, "_"))
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{className}</CardTitle>
          <CardDescription>
            {students.length} students loaded
            {(solvedRank !== "all" || hardRank !== "all" || streakRank !== "all") && " - sorted"}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={loading || visibleStudents.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={loading || visibleStudents.length === 0}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            Failed to load students: {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Top 3 leaderboard by streak */}
            <div className="grid gap-3 sm:grid-cols-3">
              {topThree.map((student, idx) => (
                <div
                  key={student.reg_no}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                      idx === 0
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                        : idx === 1
                        ? "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                    )}
                  >
                    #{idx + 1}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{student.name}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{student.reg_no}</p>
                  </div>
                  <div className="flex items-center gap-1 font-medium text-orange-500">
                    <Trophy className="h-3 w-3" />
                    <span>{student.current_streak}</span>
                  </div>
                </div>
              ))}
              {topThree.length === 0 && (
                <p className="col-span-3 py-2 text-center text-sm text-gray-500">No students yet</p>
              )}
            </div>

            {/* Filters + search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <Button
                  variant={leetcodeOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLeetcodeOnly((v) => !v)}
                >
                  <Link2 className="mr-1 h-3 w-3" />
                  LeetCode Linked
                </Button>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Problems solved
                  </label>
                  <Select value={solvedRank} onValueChange={(v) => setSolvedRank(v as RankFilter)}>
                    <SelectTrigger className="h-9 w-[150px]">
                      <SelectValue placeholder="No sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">No sort</SelectItem>
                      <SelectItem value="top">Highest first</SelectItem>
                      <SelectItem value="least">Lowest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Hard problems solved
                  </label>
                  <Select value={hardRank} onValueChange={(v) => setHardRank(v as RankFilter)}>
                    <SelectTrigger className="h-9 w-[150px]">
                      <SelectValue placeholder="No sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">No sort</SelectItem>
                      <SelectItem value="top">Highest first</SelectItem>
                      <SelectItem value="least">Lowest first</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Streak</label>
                  <Select value={streakRank} onValueChange={(v) => setStreakRank(v as RankFilter)}>
                    <SelectTrigger className="h-9 w-[150px]">
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

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search students..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Students table with summary counts */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>LeetCode</TableHead>
                  <TableHead>GitHub</TableHead>
                  <TableHead className="text-center">Easy</TableHead>
                  <TableHead className="text-center">Medium</TableHead>
                  <TableHead className="text-center">Hard</TableHead>
                  <TableHead className="text-center">Total Solved</TableHead>
                  <TableHead className="text-center">Streak</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStudents.map((student) => (
                  <TableRow key={student.reg_no}>
                    <TableCell className="font-medium">{student.reg_no}</TableCell>
                    <TableCell>{student.name}</TableCell>
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
                    <TableCell className="text-center">{student.easy_count}</TableCell>
                    <TableCell className="text-center">{student.medium_count}</TableCell>
                    <TableCell className="text-center">{student.hard_count}</TableCell>
                    <TableCell className="text-center">{student.total_solved}</TableCell>
                    <TableCell className="text-center font-medium text-orange-500">
                      {student.current_streak}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/student/${student.reg_no}`}>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-6 text-gray-500">
                      No students match your search/filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}