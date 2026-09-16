"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft, Building2, Loader2, School, Search, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import ClassDetailPanel from "@/components/staff-dashboard/ClassDetailPanel"
import type { Class } from "@/types"

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

// Matches public.class_staff -- used here only to count assigned staff
// per class for the browse cards; the actual staff table lives on the
// ClassDetailPanel this page now renders inline.
type ClassStaffRow = {
  id: string
  class_id: string
  staff_id: string
  role: "Tutor" | "Class Advisor"
  status: string | null
  status_updated_at: string | null
}

// Dean-only page. Structure mirrors the Staff Details page's drill-down
// (Department -> Year -> Class). Clicking a class no longer navigates
// away -- it renders ClassDetailPanel inline as a 4th drill-down level.
export default function DeanClassBrowserPage() {
  const [myStaff, setMyStaff] = useState<StaffRow | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [deptStaff, setDeptStaff] = useState<StaffRow[]>([])
  // classStaff is fetched for potential future status/count use on the
  // ClassDetailPanel; it isn't read directly in this file's memoized
  // calculations (those derive counts from deptStaff instead).
  const [, setClassStaff] = useState<ClassStaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  // Drill-down state: department -> year -> class (rendered inline).
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null)

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

      if (staffRow.role !== "Dean") {
        setError("This page is only available to the Dean.")
        setLoading(false)
        return
      }

      setMyStaff(staffRow)

      // 3. Every class, across every department -- Dean is unscoped.
      const { data: classRows, error: classesError } = await supabase
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

      setClasses(classRows || [])

      // 4. Every staff member, across every department -- used only for
      //    the "N staff" counts on the browse cards.
      const { data: staffRows, error: deptStaffError } = await supabase
        .from("staff")
        .select("*")
        .order("role", { ascending: true })
        .order("name", { ascending: true })

      if (deptStaffError) {
        setError(deptStaffError.message)
        setLoading(false)
        return
      }

      setDeptStaff(staffRows || [])

      // 5. class_staff rows for every class -- used only to count
      //    assigned staff per class/year/department on the browse cards.
      const classIds = (classRows || []).map((c) => c.id)
      if (classIds.length > 0) {
        const { data: classStaffRows, error: classStaffError } = await supabase
          .from("class_staff")
          .select("id, class_id, staff_id, role, status, status_updated_at")
          .in("class_id", classIds)

        if (classStaffError) {
          // Non-fatal -- the page still works without status/count data.
          console.error("Failed to load class_staff:", classStaffError.message)
        } else {
          setClassStaff(classStaffRows || [])
        }
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Real teaching staff assigned to a class: Teacher / Tutor / Class
  // Advisor rows whose own year+section matches this class exactly.
  // HOD/Dean rows are excluded -- they oversee, they aren't "assigned"
  // to a specific class.
  // Wrapped in useCallback so it has a stable identity tied to its real
  // dependency (deptStaff), which lets classStaffCounts below declare it
  // as a dependency without recomputing on every render.
  const getAssignedTeachers = useCallback(
    (cls: ClassRow) =>
      deptStaff.filter(
        (s) => s.role !== "HOD" && s.role !== "Dean" && s.year === cls.year && s.section === cls.section
      ),
    [deptStaff]
  )

  const classStaffCounts = useMemo(() => {
    const counts = new Map<string, number>()
    classes.forEach((c) => counts.set(c.id, getAssignedTeachers(c).length))
    return counts
  }, [classes, getAssignedTeachers])

  // ---- Level 1: departments ----
  const departments = useMemo(
    () => Array.from(new Set(classes.map((c) => c.department))).filter(Boolean).sort(),
    [classes]
  )

  const classesInSelectedDept = useMemo(
    () => (selectedDepartment ? classes.filter((c) => c.department === selectedDepartment) : []),
    [classes, selectedDepartment]
  )

  // ---- Level 2: years within the selected department ----
  const yearsInSelectedDept = useMemo(
    () => Array.from(new Set(classesInSelectedDept.map((c) => c.year))).sort((a, b) => a - b),
    [classesInSelectedDept]
  )

  const classesInSelectedDeptYear = useMemo(
    () => (selectedYear != null ? classesInSelectedDept.filter((c) => c.year === selectedYear) : []),
    [classesInSelectedDept, selectedYear]
  )

  // ---- Level 3: classes within the selected department + year ----
  const filteredClasses = useMemo(
    () =>
      classesInSelectedDeptYear.filter((c) => {
        const label = `${c.class_name || ""} ${c.department} year ${c.year} ${c.section} ${c.batch || ""}`
        return label.toLowerCase().includes(searchTerm.toLowerCase())
      }),
    [classesInSelectedDeptYear, searchTerm]
  )

  // Per-department / per-year rollups for the browse cards.
  const staffCountForDept = (dept: string) => deptStaff.filter((s) => s.department === dept).length
  const classCountForDept = (dept: string) => classes.filter((c) => c.department === dept).length

  const classCountForYear = (dept: string, year: number) =>
    classes.filter((c) => c.department === dept && c.year === year).length
  const staffCountForYear = (dept: string, year: number) =>
    classes
      .filter((c) => c.department === dept && c.year === year)
      .reduce((sum, c) => sum + (classStaffCounts.get(c.id) ?? 0), 0)

  const classLabel = (c: ClassRow) => c.class_name || `Year ${c.year} - Section ${c.section}`

  // Clicking a class now renders ClassDetailPanel inline (4th level)
  // instead of navigating to a separate route.
  const goToClass = (c: ClassRow) => {
    setSelectedClass(c)
  }

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

  let headerSubtitle = "Select a department"
  if (selectedClass) {
    headerSubtitle = classLabel(selectedClass)
  } else if (selectedDepartment && selectedYear != null) {
    headerSubtitle = `Classes in ${selectedDepartment} - Year ${selectedYear}`
  } else if (selectedDepartment) {
    headerSubtitle = `Years in ${selectedDepartment}`
  }

  // Back button now unwinds 4 levels: class -> year -> department -> root.
  const handleBack = () => {
    if (selectedClass) {
      setSelectedClass(null)
      return
    }
    if (selectedYear != null) {
      setSelectedYear(null)
      return
    }
    if (selectedDepartment) {
      setSelectedDepartment(null)
      return
    }
  }

  const showBackButton = selectedClass != null || selectedYear != null || selectedDepartment != null

  return (
    <DashboardLayout userRole={myStaff?.role || "Staff"} userName={myStaff?.name || "Staff"}>
      <div className="flex flex-col space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1
              className={showBackButton ? "text-3xl font-bold tracking-tight cursor-pointer hover:text-blue-600 dark:hover:text-blue-500" : "text-3xl font-bold tracking-tight"}
              onClick={showBackButton ? resetDrilldown : undefined}
              title={showBackButton ? "Back to all departments" : undefined}
            >
              Classes
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
              {error}
            </CardContent>
          </Card>
        )}

        {!error && (
          <>
            {/* ---------------- Level 4: Selected class -- inline detail panel ---------------- */}
            {selectedClass && <ClassDetailPanel classInfo={selectedClass as unknown as Class} />}

            {/* ---------------- Level 1: Departments ---------------- */}
            {!selectedClass && !selectedDepartment && (
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

            {/* ---------------- Level 2: Years within a department ---------------- */}
            {!selectedClass && selectedDepartment && selectedYear == null && (
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

            {/* ---------------- Level 3: Classes -- click renders ClassDetailPanel inline ---------------- */}
            {!selectedClass && selectedDepartment && selectedYear != null && (
              <>
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
                        onClick={() => goToClass(c)}
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
          </>
        )}
      </div>
    </DashboardLayout>
  )
}