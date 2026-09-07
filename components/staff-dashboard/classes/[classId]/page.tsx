"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useStaffClasses } from "@/lib/hooks/use-staff-classes"
import ClassDetailPanel from "@/components/staff-dashboard/ClassDetailPanel"
import { Class } from "@/types"

export default function ClassPage() {
  const params = useParams<{ classId: string }>()
  const classId = params?.classId as string

  const { staff, classes, loading: staffLoading, error: staffError } = useStaffClasses()
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [loadingClass, setLoadingClass] = useState(true)
  const [classError, setClassError] = useState<string | null>(null)

  useEffect(() => {
    if (staffLoading) return

    // Prefer the already access-scoped list from useStaffClasses
    const fromList = classes.find((c) => c.id === classId)
    if (fromList) {
      setClassInfo(fromList)
      setLoadingClass(false)
      return
    }

    if (staffError) {
      // Staff/class list failed to load entirely — don't fall through to a raw fetch
      setLoadingClass(false)
      return
    }

    // Fallback direct fetch (still protected by your RLS policies) in case the
    // list state hasn't settled yet on first paint
    let isMounted = true
    async function loadClass() {
      const supabase = createClient()
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle()

      if (!isMounted) return

      if (error) {
        setClassError(error.message)
      } else if (!data) {
        setClassError("Class not found, or you don't have access to it.")
      } else {
        setClassInfo(data)
      }
      setLoadingClass(false)
    }

    loadClass()
    return () => {
      isMounted = false
    }
  }, [staffLoading, staffError, classes, classId])

  const loading = staffLoading || loadingClass
  const error = staffError || classError

  if (loading) {
    return (
      <DashboardLayout userRole={staff?.role as any} userName={staff?.name || "Staff"}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userRole={staff?.role as any} userName={staff?.name || "Staff"}>
      <div className="flex flex-col space-y-6 pb-12">
        {error || !classInfo ? (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="py-4 text-sm text-red-600 dark:text-red-400">
              {error || "Class not found."}
            </CardContent>
          </Card>
        ) : (
          <ClassDetailPanel classInfo={classInfo} />
        )}
      </div>
    </DashboardLayout>
  )
}