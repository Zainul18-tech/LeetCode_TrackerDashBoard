"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Download,
  Loader2,
  Mail,
  School,
  Search,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Matches public.staff
type StaffRow = {
  id: string
  name: string
  email: string
  role: "HOD" | "Teacher" | "Tutor" | "Class Advisor" | "Dean" | "Staff"
  department: string
  year: number | null
  section: string | null
  user_id: string | null
}

// Matches public.classes
type ClassRow = {
  id: string
  department: string
  year: number
  section: string
  batch: string | null
  class_name: string | null
}

// Matches public.class_staff — this is the only place `status` lives.
// Only Tutor / Class Advisor rows exist here (role check constraint), so
// a Teacher matched by year+section will simply have no status.
type ClassStaffRow = {
  id: string
  class_id: string
  staff_id: string
  role: "Tutor" | "Class Advisor"
  status: string | null
  status_updated_at: string | null
}

// A staff member as displayed for a specific class, with their status (if
// any) merged in from class_staff.
type StaffWithStatus = StaffRow & {
  status?: string | null
  status_updated_at?: string | null
}

const statusStyles: Record<string, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "On Leave": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Busy: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Unavailable: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
}
const defaultStatusStyle = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"

const roleStyles: Record<string, string> = {
  HOD: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  Dean: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  Teacher: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Tutor: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "Class Advisor": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  Staff: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

export default function StaffDetailsPage() {
  const [myStaff, setMyStaff] = useState<StaffRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [deptStaff, setDeptStaff] = useState<StaffRow[]>([])
  const [classStaff, setClassStaff] = useState<ClassStaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  // Drill-down state. HOD only ever uses `selectedClass` (they land
  // straight on the class grid, scoped to their own department). Dean
  // additionally drills through department -> year before reaching the
  // same class grid / staff table.
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null)

  const isDean = myStaff?.role === "Dean"

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

      // 2. Resolve their staff profile.
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

      setMyStaff(staffRow)

      const staffIsDean = staffRow.role === "Dean"

      // 3. Classes -- HOD is scoped to their own department; Dean gets
      //    every department and drills down through the UI instead.
      let classesQuery = supabase
        .from("classes")
        .select("*")
        .order("department", { ascending: true })
        .order("year", { ascending: true })
        .order("section", { ascending: true })

      if (!staffIsDean) {
        classesQuery = classesQuery.ilike("department", staffRow.department)
      }

      const { data: classRows, error: classesError } = await classesQuery

      if (classesError) {
        setError(classesError.message)
        setLoading(false)
        return
      }

      setClasses(classRows || [])

      // 4. Staff -- same scoping rule as classes. Matching a staff member
      //    to a class is done client-side by department + year + section,
      //    since there's no join table in this schema -- a staff row's own
      //    year/section columns ARE the class assignment.
      let staffQuery = supabase.from("staff").select("*").order("role", { ascending: true }).order("name", { ascending: true })

      if (!staffIsDean) {
        staffQuery = staffQuery.ilike("department", staffRow.department)
      }

      const { data: staffRows, error: deptStaffError } = await staffQuery

      if (deptStaffError) {
        setError(deptStaffError.message)
        setLoading(false)
        return
      }

      setDeptStaff(staffRows || [])

      // 5. class_staff rows for every relevant class -- the only place
      //    `status` lives. Fetched separately since it's a join table,
      //    not embedded on staff or classes directly.
      const classIds = (classRows || []).map((c) => c.id)
      if (classIds.length > 0) {
        const { data: classStaffRows, error: classStaffError } = await supabase
          .from("class_staff")
          .select("id, class_id, staff_id, role, status, status_updated_at")
          .in("class_id", classIds)

        if (classStaffError) {
          // Non-fatal — the page still works without status data, just
          // won't show a status for anyone.
          console.error("Failed to load class_staff:", classStaffError.message)
        } else {
          setClassStaff(classStaffRows || [])
        }
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Actual teaching staff assigned to a class: Teacher / Tutor / Class
  // Advisor rows whose own year+section matches this class exactly.
  // HOD/Dean rows are intentionally excluded here -- they oversee, they
  // aren't "assigned" to a specific class. Status is merged in from
  // class_staff, matched on BOTH class_id and staff_id so a person's
  // status for one class doesn't leak onto another class.
  // Wrapped in useCallback so it has a stable identity tied to its real
  // dependencies (deptStaff, classStaff), which lets classStaffCounts
  // below declare it as a dependency without recomputing every render.
  const getAssignedTeachers = useCallback(
    (cls: ClassRow): StaffWithStatus[] =>
      deptStaff
        .filter((s) => s.role !== "HOD" && s.role !== "Dean" && s.year === cls.year && s.section === cls.section)
        .map((s) => {
          const match = classStaff.find((cs) => cs.class_id === cls.id && cs.staff_id === s.id)
          return { ...s, status: match?.status ?? null, status_updated_at: match?.status_updated_at ?? null }
        }),
    [deptStaff, classStaff]
  )

  // What actually gets displayed for a class: only the real
  // teacher/tutor/advisor assignments. HOD/Dean are NEVER listed here --
  // if a class has no teacher assigned, the list is simply empty and the
  // UI shows a "contact admin" notice instead.
  const getStaffForClass = getAssignedTeachers

  const classStaffCounts = useMemo(() => {
    const counts = new Map<string, number>()
    classes.forEach((c) => counts.set(c.id, getAssignedTeachers(c).length))
    return counts
  }, [classes, getAssignedTeachers])

  // ---- Dean drill-down levels ----

  // Level 1: every distinct department, derived from the (unscoped)
  // classes list.
  const departments = useMemo(
    () => Array.from(new Set(classes.map((c) => c.department))).filter(Boolean).sort(),
    [classes]
  )

  const classesInSelectedDept = useMemo(
    () => (selectedDepartment ? classes.filter((c) => c.department === selectedDepartment) : []),
    [classes, selectedDepartment]
  )

  // Level 2: every distinct year within the selected department.
  const yearsInSelectedDept = useMemo(
    () => Array.from(new Set(classesInSelectedDept.map((c) => c.year))).sort((a, b) => a - b),
    [classesInSelectedDept]
  )

  const classesInSelectedDeptYear = useMemo(
    () => (selectedYear != null ? classesInSelectedDept.filter((c) => c.year === selectedYear) : []),
    [classesInSelectedDept, selectedYear]
  )

  // Level 3 (Dean) / Level 1 (HOD): the class grid actually shown, with
  // search applied. HOD searches across their whole (already scoped)
  // department; Dean searches within the selected department + year.
  const classesForGrid = isDean ? classesInSelectedDeptYear : classes

  const filteredClasses = useMemo(
    () =>
      classesForGrid.filter((c) => {
        const label = `${c.class_name || ""} ${c.department} year ${c.year} ${c.section} ${c.batch || ""}`
        return label.toLowerCase().includes(searchTerm.toLowerCase())
      }),
    [classesForGrid, searchTerm]
  )

  // Per-department / per-year rollups, for the Dean's browse cards.
  const staffCountForDept = (dept: string) => deptStaff.filter((s) => s.department === dept).length
  const classCountForDept = (dept: string) => classes.filter((c) => c.department === dept).length

  const classCountForYear = (dept: string, year: number) =>
    classes.filter((c) => c.department === dept && c.year === year).length
  const staffCountForYear = (dept: string, year: number) =>
    classes
      .filter((c) => c.department === dept && c.year === year)
      .reduce((sum, c) => sum + (classStaffCounts.get(c.id) ?? 0), 0)

  const selectedClassHasTeacher = selectedClass ? getAssignedTeachers(selectedClass).length > 0 : false
  const selectedClassStaff = selectedClass ? getStaffForClass(selectedClass) : []

  const classLabel = (c: ClassRow) => c.class_name || `Year ${c.year} - Section ${c.section}`

  const exportStaffToCsv = () => {
    if (!selectedClass) return

    const headers = ["Name", "Email", "Role", "Department", "Year", "Section", "Status"]
    const escapeCsvValue = (value: string | number | null | undefined) => {
      const str = value === null || value === undefined ? "" : String(value)
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = selectedClassStaff.map((s) => [
      s.name,
      s.email,
      s.role,
      s.department,
      s.year ?? "",
      s.section ?? "",
      s.status ?? "",
    ])

    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const slug = classLabel(selectedClass).toLowerCase().replace(/\s+/g, "-")
    link.download = `${slug}-staff.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Reset the whole drill-down back to the top (Departments for Dean,
  // Classes for everyone else). Wired to the page title below.
  const resetDrilldown = () => {
    setSelectedDepartment(null)
    setSelectedYear(null)
    setSelectedClass(null)
    setSearchTerm("")
  }

  if (loading) {
    return (
      <DashboardLayout userRole={myStaff?.role || "Staff"} userName={myStaff?.name || "Loading..."}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  // ---- Header text, based on how deep we are in the drill-down ----
  let headerSubtitle = ""
  if (selectedClass) {
    headerSubtitle = `Staff assigned to ${classLabel(selectedClass)}`
  } else if (isDean && selectedYear != null) {
    headerSubtitle = `Classes in ${selectedDepartment} - Year ${selectedYear}`
  } else if (isDean && selectedDepartment) {
    headerSubtitle = `Years in ${selectedDepartment}`
  } else if (isDean) {
    headerSubtitle = "Select a department"
  } else {
    headerSubtitle = `Classes in ${myStaff?.department || "your department"}`
  }

  // ---- Which "back" button to show, based on current depth ----
  const handleBack = () => {
    if (selectedClass) {
      setSelectedClass(null)
      return
    }
    if (isDean && selectedYear != null) {
      setSelectedYear(null)
      return
    }
    if (isDean && selectedDepartment) {
      setSelectedDepartment(null)
      return
    }
  }

  const showBackButton = selectedClass != null || (isDean && (selectedYear != null || selectedDepartment != null))

  return (
    <DashboardLayout userRole={myStaff?.role || "Staff"} userName={myStaff?.name || "Staff"}>
      <div className="flex flex-col space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1
              className={
                showBackButton
                  ? "text-3xl font-bold tracking-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-500"
                  : "text-3xl font-bold tracking-tight"
              }
              onClick={showBackButton ? resetDrilldown : undefined}
              title={showBackButton ? "Back to the top" : undefined}
            >
              Staff Details
            </h1>
            <p className="text-gray-500 dark:text-gray-400">{headerSubtitle}</p>
          </div>

          {showBackButton && (
            <Button variant="outline" size="sm" className="gap-2 w-fit" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="py-4 text-sm text-red-600 dark:text-red-400">
              Failed to load data: {error}
            </CardContent>
          </Card>
        )}

        {/* ---------------- Dean, level 1: Departments ---------------- */}
        {isDean && !selectedDepartment && !selectedClass && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Card
                key={dept}
                className="cursor-pointer transition hover:border-blue-400 hover:shadow-md dark:hover:border-blue-600"
                onClick={() => setSelectedDepartment(dept)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                    {dept}
                  </CardTitle>
                  <CardDescription>{classCountForDept(dept)} classes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <Users className="h-3.5 w-3.5" />
                    {staffCountForDept(dept)} staff
                  </div>
                </CardContent>
              </Card>
            ))}

            {departments.length === 0 && (
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No departments found.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ---------------- Dean, level 2: Years within a department --- */}
        {isDean && selectedDepartment && selectedYear == null && !selectedClass && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {yearsInSelectedDept.map((year) => (
              <Card
                key={year}
                className="cursor-pointer transition hover:border-blue-400 hover:shadow-md dark:hover:border-blue-600"
                onClick={() => setSelectedYear(year)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <School className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                    Year {year}
                  </CardTitle>
                  <CardDescription>{classCountForYear(selectedDepartment, year)} classes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <Users className="h-3.5 w-3.5" />
                    {staffCountForYear(selectedDepartment, year)} staff assigned
                  </div>
                </CardContent>
              </Card>
            ))}

            {yearsInSelectedDept.length === 0 && (
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No years found for {selectedDepartment}.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ---------------- Class grid ----------------
            Dean reaches this after picking department + year.
            Everyone else (HOD) lands here directly, scoped to their own
            department. */}
        {((isDean && selectedDepartment && selectedYear != null) || (!isDean && !selectedClass)) &&
          !selectedClass && (
            <>
              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search classes..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredClasses.map((c) => {
                  const teacherCount = classStaffCounts.get(c.id) ?? 0
                  const hasTeacher = teacherCount > 0
                  return (
                    <Card
                      key={c.id}
                      className="cursor-pointer transition hover:border-blue-400 hover:shadow-md dark:hover:border-blue-600"
                      onClick={() => setSelectedClass(c)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{classLabel(c)}</CardTitle>
                        <CardDescription>
                          {c.department} · Year {c.year} · Section {c.section}
                          {c.batch ? ` · Batch ${c.batch}` : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {hasTeacher ? (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                            <Users className="h-3.5 w-3.5" />
                            {teacherCount} staff assigned
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            No teacher assigned
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}

                {filteredClasses.length === 0 && (
                  <Card className="sm:col-span-2 lg:col-span-3">
                    <CardContent className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No classes match your search.
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

        {/* ---------------- Staff table for the selected class ---------------- */}
        {selectedClass && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{classLabel(selectedClass)}</CardTitle>
                <CardDescription>
                  {selectedClassHasTeacher
                    ? `${selectedClassStaff.length} staff member${selectedClassStaff.length === 1 ? "" : "s"} assigned to this class`
                    : "No teacher assigned to this class yet"}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportStaffToCsv}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedClassHasTeacher && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    No teacher, tutor, or class advisor has been assigned to this class yet.
                    For any enquiries regarding this class, please contact admin.
                  </span>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedClassStaff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${s.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <Mail className="h-3 w-3" />
                          {s.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            roleStyles[s.role] || defaultStatusStyle
                          }`}
                        >
                          {s.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                        {s.role === "HOD" || s.role === "Dean"
                          ? "Whole department (fallback contact)"
                          : `Year ${s.year} · Section ${s.section}`}
                      </TableCell>
                      <TableCell>
                        {s.status ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                                statusStyles[s.status] || defaultStatusStyle
                              }`}
                            >
                              {s.status}
                            </span>
                            {s.status_updated_at && (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                {new Date(s.status_updated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No status set</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {selectedClassStaff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                        No staff assigned to this class yet. Please contact admin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}