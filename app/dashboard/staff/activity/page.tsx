"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import DashboardLayout from "@/components/layout/DashboardLayout"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  History,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"

/* =========================================================
   TYPES
========================================================= */

type StaffRole =
  | "HOD"
  | "Teacher"
  | "Tutor"
  | "Class Advisor"
  | "Staff"

type Staff = {
  id: string
  name: string
  email: string
  role: StaffRole
  department: string
  year: number | null
  section: string | null
  user_id: string | null
}

type ClassRow = {
  id: string
  name?: string | null
  class_name?: string | null
  department: string
  year: number
  section: string
}

type ActivityLink = {
  title: string
  url: string
}

type ActivityRow = {
  id: string
  class_id: string
  created_by: string
  activity_name: string
  activity_type: string | null
  description: string | null
  start_date: string
  end_date: string
  number_of_days: number
  remarks: string | null
  document_urls: ActivityLink[]
  created_at: string
  updated_at: string
}

type ActivityWithDetails = ActivityRow & {
  classData?: ClassRow | null
  creator?: Staff | null
}

/* =========================================================
   CONSTANTS
========================================================= */

const ACTIVITY_TYPES = [
  "Mock Interview",
  "Technical Interview",
  "Domain-Specific Interview",
  "MCQ Test",
  "Group Discussion (GD)",
  "Aptitude Test",
  "Verbal Test",
  "Vocabulary Practice",
  "DSA Test",
  "other",
]

/* =========================================================
   HELPERS
========================================================= */

function getClassName(classData?: ClassRow | null) {
  if (!classData) {
    return "Unknown Class"
  }

  return (
    classData.class_name ||
    classData.name ||
    `${classData.department} Y${classData.year} ${classData.section}`
  )
}

function formatDate(date: string) {
  if (!date) return "-"

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getYearSuffix(year: number) {
  if (year === 1) return "st"
  if (year === 2) return "nd"
  if (year === 3) return "rd"
  return "th"
}

function normalizeDocumentUrls(value: unknown): ActivityLink[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item) => {
      return (
        item &&
        typeof item === "object" &&
        typeof (item as any).title === "string" &&
        typeof (item as any).url === "string"
      )
    })
    .map((item: any) => ({
      title: item.title.trim(),
      url: item.url.trim(),
    }))
    .filter((item) => item.title && item.url)
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url)

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    )
  } catch {
    return false
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function ActivitiesPage() {
  const [supabase] = useState(() => createClient())

  /* -------------------------------------------------------
     USER DATA
  ------------------------------------------------------- */

  const [staff, setStaff] = useState<Staff | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [activities, setActivities] = useState<ActivityWithDetails[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* -------------------------------------------------------
     FILTERS
  ------------------------------------------------------- */

  const [searchTerm, setSearchTerm] = useState("")

  const [yearFilter, setYearFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [sectionFilter, setSectionFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState("recent")

  const [staffClassFilter, setStaffClassFilter] =
    useState("all")

  /* -------------------------------------------------------
     CREATE / EDIT DIALOG
  ------------------------------------------------------- */

  const [createOpen, setCreateOpen] = useState(false)

  const [editingActivity, setEditingActivity] =
    useState<ActivityWithDetails | null>(null)

  const [saving, setSaving] = useState(false)

  const [activityName, setActivityName] = useState("")
  const [activityType, setActivityType] = useState("")
  const [description, setDescription] = useState("")
  const [selectedClassId, setSelectedClassId] =
    useState("")

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [numberOfDays, setNumberOfDays] =
    useState("1")

  const [remarks, setRemarks] = useState("")

  const [documentLinks, setDocumentLinks] =
    useState<ActivityLink[]>([
      {
        title: "",
        url: "",
      },
    ])

  /* -------------------------------------------------------
     DETAILS
  ------------------------------------------------------- */

  const [selectedActivity, setSelectedActivity] =
    useState<ActivityWithDetails | null>(null)

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadData()
  }, [])

  /* =========================================================
     LOAD USER + CLASSES + ACTIVITIES
  ========================================================= */

  async function loadData() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError(
        "You are not logged in. Please sign in again."
      )

      setLoading(false)
      return
    }

    const {
      data: staffRow,
      error: staffError,
    } = await supabase
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
        "No staff profile is linked to this login. Ask your HOD/admin to link staff.user_id."
      )

      setLoading(false)
      return
    }

    const currentStaff = staffRow as Staff

    setStaff(currentStaff)

    let classRows: ClassRow[] = []

    /* -------------------------------------------------------
       HOD / TEACHER / STAFF
       Can work with all classes in their department
    ------------------------------------------------------- */

    if (
      currentStaff.role === "HOD" ||
      currentStaff.role === "Teacher" ||
      currentStaff.role === "Staff"
    ) {
      const {
        data,
        error: classError,
      } = await supabase
        .from("classes")
        .select("*")
        .ilike(
          "department",
          currentStaff.department
        )
        .order("year", {
          ascending: true,
        })
        .order("section", {
          ascending: true,
        })

      if (classError) {
        setError(classError.message)
        setLoading(false)
        return
      }

      classRows = (data || []) as ClassRow[]
    }

    /* -------------------------------------------------------
       TUTOR / CLASS ADVISOR
       Only assigned classes
    ------------------------------------------------------- */

    else {
      const {
        data,
        error: assignmentError,
      } = await supabase
        .from("class_staff")
        .select(
          `
            class_id,
            role,
            classes(*)
          `
        )
        .eq("staff_id", currentStaff.id)
        .in("role", [
          "Tutor",
          "Class Advisor",
        ])

      if (assignmentError) {
        setError(
          assignmentError.message
        )

        setLoading(false)
        return
      }

      classRows = (data || [])
        .map((row: any) => row.classes)
        .filter(Boolean) as ClassRow[]

      classRows = Array.from(
        new Map(
          classRows.map((item) => [
            item.id,
            item,
          ])
        ).values()
      )
    }

    setClasses(classRows)

    if (
      currentStaff.role !== "HOD" &&
      classRows.length === 1
    ) {
      setSelectedClassId(classRows[0].id)
    }

    await loadActivities(
      currentStaff,
      classRows
    )

    setLoading(false)
  }

  /* =========================================================
     LOAD ACTIVITIES
  ========================================================= */

  async function loadActivities(
    currentStaff: Staff,
    classRows: ClassRow[]
  ) {
    setError(null)

    const classIds = classRows.map(
      (item) => item.id
    )

    if (classIds.length === 0) {
      setActivities([])
      return
    }

    const {
      data,
      error: activityError,
    } = await supabase
      .from("activities")
      .select("*")
      .in("class_id", classIds)
      .order("start_date", {
        ascending: false,
      })

    if (activityError) {
      setError(activityError.message)
      return
    }

    const activityRows =
      (data || []) as ActivityRow[]

    if (activityRows.length === 0) {
      setActivities([])
      return
    }

    const activityClassIds =
      Array.from(
        new Set(
          activityRows.map(
            (item) => item.class_id
          )
        )
      )

    const creatorIds =
      Array.from(
        new Set(
          activityRows.map(
            (item) => item.created_by
          )
        )
      )

    const [
      { data: classRowsResult },
      { data: creatorRows },
    ] = await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .in(
          "id",
          activityClassIds
        ),

      supabase
        .from("staff")
        .select("*")
        .in(
          "id",
          creatorIds
        ),
    ])

    const classMap = new Map(
      (
        (classRowsResult ||
          []) as ClassRow[]
      ).map((item) => [
        item.id,
        item,
      ])
    )

    const creatorMap = new Map(
      (
        (creatorRows ||
          []) as Staff[]
      ).map((item) => [
        item.id,
        item,
      ])
    )

    const combined: ActivityWithDetails[] =
      activityRows.map(
        (activity) => ({
          ...activity,

          document_urls:
            normalizeDocumentUrls(
              activity.document_urls
            ),

          classData:
            classMap.get(
              activity.class_id
            ) || null,

          creator:
            creatorMap.get(
              activity.created_by
            ) || null,
        })
      )

    setActivities(combined)
  }

  /* =========================================================
     FILTER DATA
  ========================================================= */

  const years = useMemo(() => {
    return Array.from(
      new Set(
        classes.map(
          (item) => item.year
        )
      )
    ).sort((a, b) => a - b)
  }, [classes])

  const filteredClassesForHod =
    useMemo(() => {
      if (yearFilter === "all") {
        return classes
      }

      return classes.filter(
        (item) =>
          String(item.year) ===
          yearFilter
      )
    }, [classes, yearFilter])

  const sections = useMemo(() => {
    return Array.from(
      new Set(
        filteredClassesForHod.map(
          (item) => item.section
        )
      )
    ).sort()
  }, [filteredClassesForHod])

  const filteredActivities =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase()

      let result =
        activities.filter(
          (activity) => {
            const classData =
              activity.classData

            if (!classData) {
              return false
            }

            if (
              yearFilter !== "all" &&
              String(
                classData.year
              ) !== yearFilter
            ) {
              return false
            }

            if (
              classFilter !== "all" &&
              classData.id !==
                classFilter
            ) {
              return false
            }

            if (
              sectionFilter !==
                "all" &&
              classData.section !==
                sectionFilter
            ) {
              return false
            }

            if (
              typeFilter !== "all" &&
              activity.activity_type !==
                typeFilter
            ) {
              return false
            }

            if (
              staff?.role !== "HOD" &&
              staffClassFilter !==
                "all" &&
              classData.id !==
                staffClassFilter
            ) {
              return false
            }

            if (search) {
              const linkSearch =
                normalizeDocumentUrls(
                  activity.document_urls
                )
                  .map(
                    (link) =>
                      `${link.title} ${link.url}`
                  )
                  .join(" ")

              const searchable = [
                activity.activity_name,
                activity.activity_type ||
                  "",
                activity.description ||
                  "",
                activity.remarks ||
                  "",
                getClassName(
                  classData
                ),
                activity.creator
                  ?.name || "",
                linkSearch,
              ]
                .join(" ")
                .toLowerCase()

              if (
                !searchable.includes(
                  search
                )
              ) {
                return false
              }
            }

            return true
          }
        )

      result = [...result].sort(
        (a, b) => {
          const first =
            new Date(
              a.start_date
            ).getTime()

          const second =
            new Date(
              b.start_date
            ).getTime()

          if (
            sortOrder === "oldest"
          ) {
            return first - second
          }

          return second - first
        }
      )

      return result
    }, [
      activities,
      searchTerm,
      yearFilter,
      classFilter,
      sectionFilter,
      typeFilter,
      staffClassFilter,
      sortOrder,
      staff,
    ])

  /* =========================================================
     HOD STATISTICS
  ========================================================= */

  const activityCountsByClass =
    useMemo(() => {
      const counts =
        new Map<string, number>()

      activities.forEach(
        (activity) => {
          counts.set(
            activity.class_id,
            (counts.get(
              activity.class_id
            ) || 0) + 1
          )
        }
      )

      return counts
    }, [activities])

  const highActivityClasses =
    useMemo(() => {
      return [...classes]
        .map((classData) => ({
          ...classData,

          activityCount:
            activityCountsByClass.get(
              classData.id
            ) || 0,
        }))
        .sort(
          (a, b) =>
            b.activityCount -
            a.activityCount
        )
        .slice(0, 5)
    }, [
      classes,
      activityCountsByClass,
    ])

  /* =========================================================
     FORM HELPERS
  ========================================================= */

  function resetForm() {
    setActivityName("")
    setActivityType("")
    setDescription("")

    setSelectedClassId(
      staff?.role === "HOD"
        ? ""
        : classes.length === 1
        ? classes[0].id
        : ""
    )

    setStartDate("")
    setEndDate("")
    setNumberOfDays("1")
    setRemarks("")

    setDocumentLinks([
      {
        title: "",
        url: "",
      },
    ])

    setEditingActivity(null)
  }

  function calculateDays(
    start: string,
    end: string
  ) {
    if (!start || !end) {
      return
    }

    const startTime =
      new Date(
        `${start}T00:00:00`
      ).getTime()

    const endTime =
      new Date(
        `${end}T00:00:00`
      ).getTime()

    if (endTime < startTime) {
      setNumberOfDays("1")
      return
    }

    const days =
      Math.floor(
        (endTime - startTime) /
          (1000 *
            60 *
            60 *
            24)
      ) + 1

    setNumberOfDays(
      String(days)
    )
  }

  function addDocumentLink() {
    setDocumentLinks(
      (previous) => [
        ...previous,
        {
          title: "",
          url: "",
        },
      ]
    )
  }

  function updateDocumentLink(
    index: number,
    field: "title" | "url",
    value: string
  ) {
    setDocumentLinks(
      (previous) =>
        previous.map(
          (
            link,
            linkIndex
          ) =>
            linkIndex === index
              ? {
                  ...link,
                  [field]: value,
                }
              : link
        )
    )
  }

  function removeDocumentLink(
    index: number
  ) {
    setDocumentLinks(
      (previous) => {
        const updated =
          previous.filter(
            (_, linkIndex) =>
              linkIndex !== index
          )

        if (
          updated.length === 0
        ) {
          return [
            {
              title: "",
              url: "",
            },
          ]
        }

        return updated
      }
    )
  }

  function cleanDocumentLinks() {
    return documentLinks
      .map((link) => ({
        title:
          link.title.trim(),
        url: link.url.trim(),
      }))
      .filter(
        (link) =>
          link.title.length > 0 &&
          link.url.length > 0
      )
  }

  /* =========================================================
     OPEN CREATE DIALOG
  ========================================================= */

  function openCreateDialog() {
    resetForm()
    setCreateOpen(true)
  }

  /* =========================================================
     OPEN EDIT DIALOG
  ========================================================= */

  function openEditDialog(
    activity: ActivityWithDetails
  ) {
    if (
      !staff ||
      staff.role === "HOD"
    ) {
      return
    }

    setEditingActivity(
      activity
    )

    setActivityName(
      activity.activity_name
    )

    setActivityType(
      activity.activity_type || ""
    )

    setDescription(
      activity.description || ""
    )

    setSelectedClassId(
      activity.class_id
    )

    setStartDate(
      activity.start_date
    )

    setEndDate(
      activity.end_date
    )

    setNumberOfDays(
      String(
        activity.number_of_days
      )
    )

    setRemarks(
      activity.remarks || ""
    )

    const existingLinks =
      normalizeDocumentUrls(
        activity.document_urls
      )

    setDocumentLinks(
      existingLinks.length > 0
        ? existingLinks
        : [
            {
              title: "",
              url: "",
            },
          ]
    )

    setCreateOpen(true)
  }

  /* =========================================================
     SAVE ACTIVITY
     CREATE + UPDATE
  ========================================================= */

  async function handleSaveActivity() {
    if (!staff) {
      return
    }

    setError(null)

    /* HOD cannot create/update */

    if (staff.role === "HOD") {
      setError(
        "HOD can only view activities."
      )
      return
    }

    /* Basic validation */

    if (!activityName.trim()) {
      setError(
        "Activity name is required."
      )
      return
    }

    if (!selectedClassId) {
      setError(
        "Please select a class."
      )
      return
    }

    if (!startDate) {
      setError(
        "Start date is required."
      )
      return
    }

    if (!endDate) {
      setError(
        "End date is required."
      )
      return
    }

    if (
      new Date(endDate) <
      new Date(startDate)
    ) {
      setError(
        "End date cannot be before the start date."
      )
      return
    }

    /* Validate links */

    const links =
      cleanDocumentLinks()

    const incompleteLink =
      documentLinks.some(
        (link) => {
          const hasTitle =
            link.title.trim()
              .length > 0

          const hasUrl =
            link.url.trim()
              .length > 0

          return (
            (hasTitle &&
              !hasUrl) ||
            (!hasTitle &&
              hasUrl)
          )
        }
      )

    if (incompleteLink) {
      setError(
        "Please provide both a title and URL for each resource link."
      )
      return
    }

    const invalidLink =
      links.find(
        (link) =>
          !isValidUrl(link.url)
      )

    if (invalidLink) {
      setError(
        `Invalid URL for "${invalidLink.title}". Please enter a valid http:// or https:// URL.`
      )
      return
    }

    setSaving(true)

    try {
      /* -----------------------------------------------------
         CLIENT-SIDE CLASS AUTHORIZATION
      ----------------------------------------------------- */

      if (
        staff.role === "Tutor" ||
        staff.role ===
          "Class Advisor"
      ) {
        const {
          data: assignment,
          error:
            assignmentError,
        } = await supabase
          .from("class_staff")
          .select(
            "id, role"
          )
          .eq(
            "class_id",
            selectedClassId
          )
          .eq(
            "staff_id",
            staff.id
          )
          .in("role", [
            "Tutor",
            "Class Advisor",
          ])
          .maybeSingle()

        if (assignmentError) {
          throw new Error(
            assignmentError.message
          )
        }

        if (!assignment) {
          throw new Error(
            "You are not assigned to this class as a Tutor or Class Advisor."
          )
        }
      }

      /* -----------------------------------------------------
         CALCULATE DAYS
      ----------------------------------------------------- */

      const days =
        Math.max(
          1,
          Math.floor(
            (
              new Date(
                `${endDate}T00:00:00`
              ).getTime() -
              new Date(
                `${startDate}T00:00:00`
              ).getTime()
            ) /
              (1000 *
                60 *
                60 *
                24)
          ) + 1
        )

      /* -----------------------------------------------------
         UPDATE
      ----------------------------------------------------- */

      if (editingActivity) {
        const {
          error: updateError,
        } = await supabase
          .from("activities")
          .update({
            class_id:
              selectedClassId,

            activity_name:
              activityName.trim(),

            activity_type:
              activityType ||
              null,

            description:
              description.trim() ||
              null,

            start_date:
              startDate,

            end_date:
              endDate,

            number_of_days:
              days,

            remarks:
              remarks.trim() ||
              null,

            document_urls:
              links,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            editingActivity.id
          )

        if (updateError) {
          throw new Error(
            updateError.message
          )
        }
      }

      /* -----------------------------------------------------
         CREATE
      ----------------------------------------------------- */

      else {
        const {
          error: createError,
        } = await supabase
          .from("activities")
          .insert({
            class_id:
              selectedClassId,

            created_by:
              staff.id,

            activity_name:
              activityName.trim(),

            activity_type:
              activityType ||
              null,

            description:
              description.trim() ||
              null,

            start_date:
              startDate,

            end_date:
              endDate,

            number_of_days:
              days,

            remarks:
              remarks.trim() ||
              null,

            document_urls:
              links,
          })

        if (createError) {
          throw new Error(
            createError.message
          )
        }
      }

      /* -----------------------------------------------------
         CLOSE + RELOAD
      ----------------------------------------------------- */

      setCreateOpen(false)
      resetForm()

      await loadActivities(
        staff,
        classes
      )
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to save activity."
      )
    } finally {
      setSaving(false)
    }
  }

  /* =========================================================
     DELETE ACTIVITY
  ========================================================= */

  async function handleDeleteActivity(
    activity: ActivityWithDetails
  ) {
    if (!staff) {
      return
    }

    if (staff.role === "HOD") {
      setError(
        "HOD cannot delete activities."
      )
      return
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${activity.activity_name}"? This action cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    setError(null)

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("activities")
        .delete()
        .eq(
          "id",
          activity.id
        )

      if (deleteError) {
        throw new Error(
          deleteError.message
        )
      }

      if (
        selectedActivity?.id ===
        activity.id
      ) {
        setSelectedActivity(null)
      }

      await loadActivities(
        staff,
        classes
      )
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to delete activity."
      )
    }
  }

  /* =========================================================
     OPEN ACTIVITY
  ========================================================= */

  function openActivity(
    activity: ActivityWithDetails
  ) {
    setSelectedActivity(
      activity
    )
  }

  /* =========================================================
     OPEN EXTERNAL DOCUMENT
  ========================================================= */

  function openDocumentUrl(
    url: string
  ) {
    if (!isValidUrl(url)) {
      setError(
        "This document link is not a valid URL."
      )
      return
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    )
  }

  /* =========================================================
     CHECK IF CURRENT STAFF CAN MANAGE
  ========================================================= */

  function canManageActivity(
    activity: ActivityWithDetails
  ) {
    if (!staff) {
      return false
    }

    if (staff.role === "HOD") {
      return false
    }

    /*
     * Staff can update/delete
     * activities they created.
     *
     * RLS should enforce the
     * same rule in Supabase.
     */

    return (
      activity.created_by ===
      staff.id
    )
  }

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  function clearFilters() {
    setYearFilter("all")
    setClassFilter("all")
    setSectionFilter("all")
    setTypeFilter("all")
    setSortOrder("recent")
    setSearchTerm("")
    setStaffClassFilter("all")
  }

  /* =========================================================
     LOADING SCREEN
  ========================================================= */

  if (loading) {
    return (
      <DashboardLayout
        userRole="Teacher"
        userName="Loading..."
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  const isHOD =
    staff?.role === "HOD"

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <DashboardLayout
      userRole={
        staff?.role || "Teacher"
      }
      userName={
        staff?.name || "Staff"
      }
    >
      <div className="flex flex-col space-y-6 pb-12">

        {/* ===================================================
            HEADER
        ==================================================== */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-7 w-7 text-blue-600" />

              <h1 className="text-3xl font-bold tracking-tight">
                Activities
              </h1>
            </div>

            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {isHOD
                ? "View and monitor activities conducted across your department."
                : "Record and manage activities conducted for your classes."}
            </p>
          </div>

          {/* ===============================================
              POST ACTIVITY
          ================================================ */}

          {!isHOD && (
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open)

                if (!open) {
                  resetForm()
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={
                    openCreateDialog
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Post Activity
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingActivity
                      ? "Update Activity"
                      : "Post New Activity"}
                  </DialogTitle>

                  <DialogDescription>
                    {editingActivity
                      ? "Update the activity information and shared resources."
                      : "Record an activity conducted for your class and optionally share document or folder links."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">

                  {/* CLASS */}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Class
                    </label>

                    <Select
                      value={
                        selectedClassId
                      }
                      onValueChange={
                        setSelectedClassId
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>

                      <SelectContent>
                        {classes.map(
                          (
                            classData
                          ) => (
                            <SelectItem
                              key={
                                classData.id
                              }
                              value={
                                classData.id
                              }
                            >
                              {getClassName(
                                classData
                              )}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>

                    <p className="text-xs text-gray-500">
                      {staff?.role ===
                        "Tutor" ||
                      staff?.role ===
                        "Class Advisor"
                        ? "Only classes assigned to you are available."
                        : "Classes from your department are available."}
                    </p>
                  </div>

                  {/* ACTIVITY NAME */}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Activity Name
                    </label>

                    <Input
                      placeholder="Example: Industrial Visit"
                      value={
                        activityName
                      }
                      onChange={(e) =>
                        setActivityName(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* ACTIVITY TYPE */}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Activity Type
                    </label>

                    <Select
                      value={
                        activityType
                      }
                      onValueChange={
                        setActivityType
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select activity type" />
                      </SelectTrigger>

                      <SelectContent>
                        {ACTIVITY_TYPES.map(
                          (type) => (
                            <SelectItem
                              key={type}
                              value={type}
                            >
                              {type}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* DESCRIPTION */}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Description
                    </label>

                    <Textarea
                      placeholder="Describe what was conducted..."
                      rows={4}
                      value={
                        description
                      }
                      onChange={(e) =>
                        setDescription(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* DATES */}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Date Started
                      </label>

                      <Input
                        type="date"
                        value={
                          startDate
                        }
                        onChange={(e) => {
                          setStartDate(
                            e.target.value
                          )

                          calculateDays(
                            e.target.value,
                            endDate
                          )
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Date Ended
                      </label>

                      <Input
                        type="date"
                        value={
                          endDate
                        }
                        min={
                          startDate ||
                          undefined
                        }
                        onChange={(e) => {
                          setEndDate(
                            e.target.value
                          )

                          calculateDays(
                            startDate,
                            e.target.value
                          )
                        }}
                      />
                    </div>
                  </div>

                  {/* NUMBER OF DAYS */}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Number of Days
                    </label>

                    <Input
                      type="number"
                      min={1}
                      value={
                        numberOfDays
                      }
                      readOnly
                    />

                    <p className="text-xs text-gray-500">
                      Automatically calculated from the start and end dates.
                    </p>
                  </div>

                  {/* DOCUMENT LINKS */}

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">
                        Documents / Resources
                      </label>

                      <p className="mt-1 text-xs text-gray-500">
                        Paste Google Drive, OneDrive, Dropbox, folder or other external links. No files are uploaded to this system.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {documentLinks.map(
                        (
                          link,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                            className="rounded-lg border p-3"
                          >
                            <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">

                              <Input
                                placeholder="Link title"
                                value={
                                  link.title
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateDocumentLink(
                                    index,
                                    "title",
                                    e
                                      .target
                                      .value
                                  )
                                }
                              />

                              <Input
                                placeholder="https://drive.google.com/..."
                                value={
                                  link.url
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateDocumentLink(
                                    index,
                                    "url",
                                    e
                                      .target
                                      .value
                                  )
                                }
                              />

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  removeDocumentLink(
                                    index
                                  )
                                }
                                disabled={
                                  documentLinks.length ===
                                  1
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={
                        addDocumentLink
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Document / Folder Link
                    </Button>
                  </div>

                  {/* REMARKS */}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Additional Remarks
                    </label>

                    <Textarea
                      placeholder="Any additional information..."
                      rows={3}
                      value={
                        remarks
                      }
                      onChange={(e) =>
                        setRemarks(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* ACTIONS */}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setCreateOpen(
                          false
                        )
                      }
                      disabled={saving}
                    >
                      Cancel
                    </Button>

                    <Button
                      type="button"
                      onClick={
                        handleSaveActivity
                      }
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                          {editingActivity
                            ? "Updating..."
                            : "Posting..."}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />

                          {editingActivity
                            ? "Update Activity"
                            : "Post Activity"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* ===================================================
            ERROR
        ==================================================== */}

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setError(null)
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===================================================
            HOD OVERVIEW
        ==================================================== */}

        {isHOD && (
          <>
            <div className="grid gap-4 md:grid-cols-3">

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Activities
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">
                    {
                      activities.length
                    }
                  </div>

                  <p className="text-xs text-gray-500">
                    Department-wide
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Classes
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">
                    {
                      classes.length
                    }
                  </div>

                  <p className="text-xs text-gray-500">
                    In your department
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Most Active Class
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {highActivityClasses[0] ? (
                    <>
                      <div className="truncate text-lg font-bold">
                        {getClassName(
                          highActivityClasses[0]
                        )}
                      </div>

                      <p className="text-xs text-gray-500">
                        {
                          highActivityClasses[0]
                            .activityCount
                        }{" "}
                        activities
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No activity data
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* MOST ACTIVE CLASSES */}

            <Card>
              <CardHeader>
                <CardTitle>
                  Most Active Classes
                </CardTitle>

                <CardDescription>
                  Classes ranked by number of recorded activities.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  {highActivityClasses.map(
                    (
                      classData,
                      index
                    ) => (
                      <button
                        key={
                          classData.id
                        }
                        type="button"
                        onClick={() => {
                          setYearFilter(
                            String(
                              classData.year
                            )
                          )

                          setClassFilter(
                            classData.id
                          )

                          setSectionFilter(
                            "all"
                          )
                        }}
                        className="rounded-lg border p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            #{index + 1}
                          </span>

                          <Activity className="h-4 w-4 text-blue-600" />
                        </div>

                        <p className="mt-2 truncate font-medium">
                          {getClassName(
                            classData
                          )}
                        </p>

                        <p className="text-xs text-gray-500">
                          {
                            classData.activityCount
                          }{" "}
                          activities
                        </p>
                      </button>
                    )
                  )}

                  {highActivityClasses.length ===
                    0 && (
                    <p className="text-sm text-gray-500">
                      No activity records yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ===================================================
            FILTERS
        ==================================================== */}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />

                  {isHOD
                    ? "Activity Filters"
                    : "Activity History"}
                </CardTitle>

                <CardDescription>
                  {isHOD
                    ? "Filter activities by year, class, section and type."
                    : "Search and filter activities from your classes."}
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={
                  clearFilters
                }
              >
                Clear Filters
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">

              {/* SEARCH */}

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

                <Input
                  placeholder="Search activities..."
                  className="pl-9"
                  value={
                    searchTerm
                  }
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                />
              </div>

              {/* HOD FILTERS */}

              {isHOD ? (
                <>
                  <Select
                    value={
                      yearFilter
                    }
                    onValueChange={(
                      value
                    ) => {
                      setYearFilter(
                        value
                      )

                      setClassFilter(
                        "all"
                      )

                      setSectionFilter(
                        "all"
                      )
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        All Years
                      </SelectItem>

                      {years.map(
                        (year) => (
                          <SelectItem
                            key={
                              year
                            }
                            value={String(
                              year
                            )}
                          >
                            {year}
                            {getYearSuffix(
                              year
                            )}{" "}
                            Year
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={
                      classFilter
                    }
                    onValueChange={
                      setClassFilter
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        All Classes
                      </SelectItem>

                      {filteredClassesForHod.map(
                        (
                          classData
                        ) => (
                          <SelectItem
                            key={
                              classData.id
                            }
                            value={
                              classData.id
                            }
                          >
                            {getClassName(
                              classData
                            )}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={
                      sectionFilter
                    }
                    onValueChange={
                      setSectionFilter
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        All Sections
                      </SelectItem>

                      {sections.map(
                        (
                          section
                        ) => (
                          <SelectItem
                            key={
                              section
                            }
                            value={
                              section
                            }
                          >
                            Section{" "}
                            {
                              section
                            }
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={
                      typeFilter
                    }
                    onValueChange={
                      setTypeFilter
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        All Activity Types
                      </SelectItem>

                      {ACTIVITY_TYPES.map(
                        (type) => (
                          <SelectItem
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {type}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Select
                    value={
                      staffClassFilter
                    }
                    onValueChange={
                      setStaffClassFilter
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All My Classes" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        All My Classes
                      </SelectItem>

                      {classes.map(
                        (
                          classData
                        ) => (
                          <SelectItem
                            key={
                              classData.id
                            }
                            value={
                              classData.id
                            }
                          >
                            {getClassName(
                              classData
                            )}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={
                      typeFilter
                    }
                    onValueChange={
                      setTypeFilter
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="all">
                        All Activity Types
                      </SelectItem>

                      {ACTIVITY_TYPES.map(
                        (type) => (
                          <SelectItem
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {type}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={
                      sortOrder
                    }
                    onValueChange={
                      setSortOrder
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="recent">
                        Most Recent
                      </SelectItem>

                      <SelectItem value="oldest">
                        Oldest First
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* HOD SORT */}

            {isHOD && (
              <div className="mt-3">
                <Select
                  value={
                    sortOrder
                  }
                  onValueChange={
                    setSortOrder
                  }
                >
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="recent">
                      Most Recent
                    </SelectItem>

                    <SelectItem value="oldest">
                      Oldest First
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===================================================
            ACTIVITY HISTORY
        ==================================================== */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />

              {isHOD
                ? "Department Activity History"
                : "Past Activities"}
            </CardTitle>

            <CardDescription>
              {
                filteredActivities.length
              }{" "}
              activit
              {filteredActivities.length ===
              1
                ? "y"
                : "ies"}{" "}
              found.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {filteredActivities.length ===
            0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity className="mb-4 h-10 w-10 text-gray-300" />

                <h3 className="font-medium">
                  No activities found
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Try changing your filters or post a new activity.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">

                      <th className="px-3 py-3 font-medium">
                        Activity
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Class
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Date
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Duration
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Posted By
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Resources
                      </th>

                      <th className="px-3 py-3 text-right font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredActivities.map(
                      (
                        activity
                      ) => {
                        const canManage =
                          canManageActivity(
                            activity
                          )

                        return (
                          <tr
                            key={
                              activity.id
                            }
                            className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                          >
                            {/* ACTIVITY */}

                            <td className="px-3 py-4">
                              <div>
                                <p className="font-medium">
                                  {
                                    activity.activity_name
                                  }
                                </p>

                                {activity.activity_type && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    {
                                      activity.activity_type
                                    }
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* CLASS */}

                            <td className="px-3 py-4">
                              <p className="text-sm">
                                {getClassName(
                                  activity.classData
                                )}
                              </p>

                              {activity.classData && (
                                <p className="text-xs text-gray-500">
                                  Year{" "}
                                  {
                                    activity
                                      .classData
                                      .year
                                  }{" "}
                                  · Section{" "}
                                  {
                                    activity
                                      .classData
                                      .section
                                  }
                                </p>
                              )}
                            </td>

                            {/* DATE */}

                            <td className="px-3 py-4">
                              <div className="flex items-center gap-1.5 text-sm">
                                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />

                                {formatDate(
                                  activity.start_date
                                )}
                              </div>
                            </td>

                            {/* DURATION */}

                            <td className="px-3 py-4">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock3 className="h-3.5 w-3.5 text-gray-400" />

                                {
                                  activity.number_of_days
                                }{" "}
                                {activity.number_of_days ===
                                1
                                  ? "Day"
                                  : "Days"}
                              </div>
                            </td>

                            {/* POSTED BY */}

                            <td className="px-3 py-4">
                              <div>
                                <p className="text-sm">
                                  {
                                    activity
                                      .creator
                                      ?.name ||
                                    "Unknown"
                                  }
                                </p>

                                <p className="text-xs text-gray-500">
                                  {
                                    activity
                                      .creator
                                      ?.role ||
                                    ""
                                  }
                                </p>
                              </div>
                            </td>

                            {/* RESOURCES */}

                            <td className="px-3 py-4">
                              <div className="flex items-center gap-1.5 text-sm">
                                {activity.document_urls?.length >
                                0 ? (
                                  <>
                                    <LinkIcon className="h-4 w-4 text-gray-400" />

                                    {
                                      activity
                                        .document_urls
                                        .length
                                    }
                                  </>
                                ) : (
                                  <span className="text-gray-400">
                                    None
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* ACTIONS */}

                            <td className="px-3 py-4">
                              <div className="flex items-center justify-end gap-2">

                                {/* VIEW */}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    openActivity(
                                      activity
                                    )
                                  }
                                >
                                  View

                                  <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>

                                {/* UPDATE */}

                                {canManage && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      openEditDialog(
                                        activity
                                      )
                                    }
                                    title="Update activity"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* DELETE */}

                                {canManage && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      handleDeleteActivity(
                                        activity
                                      )
                                    }
                                    title="Delete activity"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===================================================
            ACTIVITY DETAILS
        ==================================================== */}

        <Dialog
          open={Boolean(
            selectedActivity
          )}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedActivity(
                null
              )
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">

            {selectedActivity && (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <DialogTitle className="text-xl">
                        {
                          selectedActivity.activity_name
                        }
                      </DialogTitle>

                      <DialogDescription className="mt-1">
                        {getClassName(
                          selectedActivity.classData
                        )}
                      </DialogDescription>
                    </div>

                    {selectedActivity.activity_type && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {
                          selectedActivity.activity_type
                        }
                      </span>
                    )}
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-2">

                  {/* BASIC INFORMATION */}

                  <div className="grid gap-3 md:grid-cols-3">

                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-gray-500">
                        Started
                      </p>

                      <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                        <CalendarDays className="h-4 w-4 text-gray-400" />

                        {formatDate(
                          selectedActivity.start_date
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-gray-500">
                        Ended
                      </p>

                      <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                        <CalendarDays className="h-4 w-4 text-gray-400" />

                        {formatDate(
                          selectedActivity.end_date
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-gray-500">
                        Duration
                      </p>

                      <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                        <Clock3 className="h-4 w-4 text-gray-400" />

                        {
                          selectedActivity.number_of_days
                        }{" "}
                        {selectedActivity.number_of_days ===
                        1
                          ? "Day"
                          : "Days"}
                      </p>
                    </div>
                  </div>

                  {/* POSTED BY */}

                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">
                      Posted By
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />

                      <div>
                        <p className="text-sm font-medium">
                          {
                            selectedActivity
                              .creator
                              ?.name ||
                            "Unknown"
                          }
                        </p>

                        <p className="text-xs text-gray-500">
                          {
                            selectedActivity
                              .creator
                              ?.role ||
                            ""
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* DESCRIPTION */}

                  {selectedActivity.description && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        Description
                      </h3>

                      <div className="rounded-lg bg-gray-50 p-4 text-sm leading-6 dark:bg-gray-900">
                        {
                          selectedActivity.description
                        }
                      </div>
                    </div>
                  )}

                  {/* REMARKS */}

                  {selectedActivity.remarks && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        Remarks
                      </h3>

                      <div className="rounded-lg bg-gray-50 p-4 text-sm leading-6 dark:bg-gray-900">
                        {
                          selectedActivity.remarks
                        }
                      </div>
                    </div>
                  )}

                  {/* DOCUMENTS */}

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <LinkIcon className="h-4 w-4" />

                        Documents & Resources
                      </h3>

                      <span className="text-xs text-gray-500">
                        {
                          selectedActivity
                            .document_urls
                            ?.length ||
                          0
                        }{" "}
                        link
                        {selectedActivity
                          .document_urls
                          ?.length ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    {!selectedActivity.document_urls ||
                    selectedActivity
                      .document_urls
                      .length === 0 ? (
                      <div className="rounded-lg border border-dashed p-8 text-center">
                        <FileText className="mx-auto mb-2 h-7 w-7 text-gray-300" />

                        <p className="text-sm text-gray-500">
                          No documents or resources attached.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedActivity.document_urls.map(
                          (
                            link,
                            index
                          ) => (
                            <button
                              key={`${link.url}-${index}`}
                              type="button"
                              onClick={() =>
                                openDocumentUrl(
                                  link.url
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                                {link.url
                                  .toLowerCase()
                                  .includes(
                                    "folder"
                                  ) ? (
                                  <FolderOpen className="h-5 w-5 text-gray-500" />
                                ) : (
                                  <FileText className="h-5 w-5 text-gray-500" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {
                                    link.title
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs text-gray-500">
                                  {
                                    link.url
                                  }
                                </p>
                              </div>

                              <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* UPDATE / DELETE */}

                  {!isHOD &&
                    canManageActivity(
                      selectedActivity
                    ) && (
                      <div className="flex justify-end gap-2 border-t pt-4">

                        <Button
                          variant="outline"
                          onClick={() =>
                            openEditDialog(
                              selectedActivity
                            )
                          }
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Update
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() =>
                            handleDeleteActivity(
                              selectedActivity
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                          Delete
                        </Button>
                      </div>
                    )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

