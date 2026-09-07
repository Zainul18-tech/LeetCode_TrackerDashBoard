"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Class } from "@/types"

export type StaffRole = "HOD" | "Teacher" | "Tutor" | "Class Advisor"

export type StaffProfile = {
  id: string
  name: string
  email: string
  role: StaffRole
  department: string
  year: number | null
  section: string | null
  user_id: string | null
}

interface UseStaffClassesResult {
  staff: StaffProfile | null
  classes: Class[]
  loading: boolean
  error: string | null
}

/**
 * Resolves the logged-in user's staff profile, then loads the classes they
 * can see: every class in their department for an HOD, or only the classes
 * they're assigned to (via class_staff) for everyone else.
 *
 * Used by both the Sidebar (to render the expandable "Classes" list) and the
 * /dashboard/classes/[classId] page (to validate access + get class details).
 */
export function useStaffClasses(): UseStaffClassesResult {
  const [staff, setStaff] = useState<StaffProfile | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !user) {
        setError("You are not logged in. Please sign in again.")
        setLoading(false)
        return
      }

      const { data: staffRow, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!isMounted) return

      if (staffError) {
        setError(staffError.message)
        setLoading(false)
        return
      }

      if (!staffRow) {
        setError("No staff profile is linked to this login. Ask your HOD/admin to set staff.user_id.")
        setLoading(false)
        return
      }

      setStaff(staffRow)

      let classResults: Class[] = []

      if (staffRow.role === "HOD") {
        const { data: deptClasses, error: classesError } = await supabase
          .from("classes")
          .select("*")
          .ilike("department", staffRow.department)
          .order("year", { ascending: true })
          .order("section", { ascending: true })

        if (!isMounted) return

        if (classesError) {
          setError(classesError.message)
          setLoading(false)
          return
        }

        classResults = deptClasses || []
      } else {
        const { data: assignments, error: assignError } = await supabase
          .from("class_staff")
          .select("class_id, classes(*)")
          .eq("staff_id", staffRow.id)

        if (!isMounted) return

        if (assignError) {
          setError(assignError.message)
          setLoading(false)
          return
        }

        classResults = (assignments || []).map((a: any) => a.classes).filter(Boolean) as Class[]
      }

      setClasses(classResults)
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  return { staff, classes, loading, error }
}