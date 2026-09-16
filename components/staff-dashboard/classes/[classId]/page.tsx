"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useStaffClasses } from "@/lib/hooks/use-staff-classes"
import ClassDetailPanel from "@/components/staff-dashboard/ClassDetailPanel"
import { Class } from "@/types"
import type { ComponentProps } from "react"

type DashboardUserRole = ComponentProps<typeof DashboardLayout>["userRole"]

type FallbackResult = {
  id: string
  data: Class | null
  error: string | null
}

export default function ClassPage() {
  const params = useParams<{ classId: string }>()
  const classId = params?.classId as string

  const { staff, classes, loading: staffLoading, error: staffError } = useStaffClasses()

  // Derived, not fetched — compute during render instead of syncing via an effect.
  const fromList = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId]
  )

  // Only ever written to from inside the async callback, after the network
  // request resolves — never synchronously at the top of the effect.
  const [fallbackResult, setFallbackResult] = useState<FallbackResult | null>(null)

  const needsFallbackFetch = !staffLoading && !staffError && !fromList

  // Everything below is *derived* from fallbackResult rather than tracked as
  // its own separately-set loading/error state, so the effect never needs to
  // call setState synchronously before the await.
  const hasResultForCurrentId = fallbackResult?.id === classId
  const fetchedClassInfo = hasResultForCurrentId ? fallbackResult!.data : null
  const fallbackError = hasResultForCurrentId ? fallbackResult!.error : null
  const isFallbackPending = needsFallbackFetch && !hasResultForCurrentId

  useEffect(() => {
    if (!needsFallbackFetch) return

    let isMounted = true

    async function loadClass() {
      const supabase = createClient()
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle()

      if (!isMounted) return

      if (error) {
        setFallbackResult({ id: classId, data: null, error: error.message })
      } else if (!data) {
        setFallbackResult({
          id: classId,
          data: null,
          error: "Class not found, or you don't have access to it.",
        })
      } else {
        setFallbackResult({ id: classId, data, error: null })
      }
    }

    loadClass()
    return () => {
      isMounted = false
    }
  }, [needsFallbackFetch, classId])

  const classInfo = fromList || fetchedClassInfo
  const loading = staffLoading || isFallbackPending
  const error = staffError || fallbackError

  if (loading) {
    return (
      <DashboardLayout userRole={staff?.role as DashboardUserRole} userName={staff?.name || "Staff"}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userRole={staff?.role as DashboardUserRole} userName={staff?.name || "Staff"}>
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