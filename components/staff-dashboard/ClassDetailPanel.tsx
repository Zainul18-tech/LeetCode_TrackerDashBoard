"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
}

type SortKey = "easy_count" | "medium_count" | "hard_count" | "current_streak" | null

interface ClassDetailPanelProps {
  classInfo: Class
}

export default function ClassDetailPanel({ classInfo }: ClassDetailPanelProps) {
  const [students, setStudents] = useState<StudentWithSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [leetcodeOnly, setLeetcodeOnly] = useState(false)

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
        .eq("class_id", classInfo.id)
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

        return {
          ...row,
          easy_count: summary?.easy_count ?? 0,
          medium_count: summary?.medium_count ?? 0,
          hard_count: summary?.hard_count ?? 0,
          current_streak: summary?.current_streak ?? 0,
        }
      })

      setStudents(normalized)
      setLoading(false)
    }

    loadStudents()
    return () => {
      isMounted = false
    }
  }, [classInfo.id])

  const topThree = useMemo(
    () => [...students].sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0)).slice(0, 3),
    [students]
  )

  const visibleStudents = useMemo(() => {
    let list = students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.reg_no.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (leetcodeOnly) {
      list = list.filter((s) => !!s.leetcode_username)
    }

    if (sortKey) {
      list = [...list].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
    }

    return list
  }, [students, searchTerm, leetcodeOnly, sortKey])

  const className = classInfo.name || `${classInfo.department} Y${classInfo.year} ${classInfo.section}`

  const handleExportPDF = () => {
    exportStudentsToPDF(visibleStudents, `${className} - Student Report`, className.replace(/\s+/g, "_"))
  }

  const handleExportExcel = () => {
    exportStudentsToExcel(visibleStudents, className.replace(/\s+/g, "_"))
  }

  const filterButtons: { label: string; key: SortKey }[] = [
    { label: "Easy", key: "easy_count" },
    { label: "Medium", key: "medium_count" },
    { label: "Hard", key: "hard_count" },
    { label: "Streak", key: "current_streak" },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{className}</CardTitle>
          <CardDescription>{students.length} students loaded</CardDescription>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={leetcodeOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLeetcodeOnly((v) => !v)}
                >
                  <Link2 className="mr-1 h-3 w-3" />
                  LeetCode Linked
                </Button>
                {filterButtons.map((f) => (
                  <Button
                    key={f.label}
                    variant={sortKey === f.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortKey((prev) => (prev === f.key ? null : f.key))}
                  >
                    Sort by {f.label}
                  </Button>
                ))}
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
                    <TableCell colSpan={9} className="text-center py-6 text-gray-500">
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