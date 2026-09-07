"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

type TaskLink = {
  name: string
  url: string
}

type Task = {
  id: string
  department: string
  title: string
  description: string | null
  due_date: string | null
  target_years: number[] | null
  applies_to_all_classes: boolean
  created_by: string | null
  created_at: string
  task_links?: TaskLink[]
}

type ClassRow = {
  id: string
  department: string
  year: number | string
  section: string | null
  batch?: string | null
  class_name?: string | null
  name?: string | null
}

type ProgressStatus =
  | "Pending"
  | "In Progress"
  | "Done"

type TaskClassProgress = {
  id: string
  task_id: string
  class_id: string
  status: ProgressStatus
  response_required: boolean
  student_question: string | null
  student_response: string | null
  response_document_url: string | null
  response_links?: TaskLink[]
  staff_note: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    )
  } catch {
    return false
  }
}

function normalizeLinks(
  value: unknown
): TaskLink[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as any).name === "string" &&
        typeof (item as any).url === "string"
    )
    .map((item) => ({
      name: String(
        (item as any).name
      ),
      url: String(
        (item as any).url
      ),
    }))
    .filter(
      (item) =>
        item.name.trim() &&
        isValidHttpUrl(
          item.url.trim()
        )
    )
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function TaskDetailsClassPage() {
  const params = useParams()
  const router = useRouter()

  const taskId =
    typeof params.taskId === "string"
      ? params.taskId
      : ""

  const classId =
    typeof params.classId === "string"
      ? params.classId
      : ""

  const [staff, setStaff] =
    useState<Staff | null>(null)

  const [task, setTask] =
    useState<Task | null>(null)

  const [classData, setClassData] =
    useState<ClassRow | null>(null)

  const [progress, setProgress] =
    useState<TaskClassProgress | null>(
      null
    )

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Form State
  // ---------------------------------------------------------------------------

  const [
    studentQuestion,
    setStudentQuestion,
  ] = useState("")

  const [
    studentResponse,
    setStudentResponse,
  ] = useState("")

  const [staffNote, setStaffNote] =
    useState("")

  const [
    responseRequired,
    setResponseRequired,
  ] = useState(false)

  const [
    responseLinks,
    setResponseLinks,
  ] = useState<TaskLink[]>([])

  // ---------------------------------------------------------------------------
  // Role
  // ---------------------------------------------------------------------------

  const isHod =
    staff?.role === "HOD"

  const isCompleted =
    progress?.status === "Done"

  // ---------------------------------------------------------------------------
  // Class Label
  // ---------------------------------------------------------------------------

  const classLabel = (
    item: ClassRow
  ) => {
    if (item.class_name) {
      return item.class_name
    }

    if (item.name) {
      return item.name
    }

    return `Year ${item.year} · Section ${
      item.section || "-"
    }`
  }

  // ---------------------------------------------------------------------------
  // Link Helpers
  // ---------------------------------------------------------------------------

  const addResponseLink = () => {
    setResponseLinks((previous) => [
      ...previous,
      {
        name: "",
        url: "",
      },
    ])
  }

  const updateResponseLink = (
    index: number,
    field: "name" | "url",
    value: string
  ) => {
    setResponseLinks((previous) =>
      previous.map((link, linkIndex) =>
        linkIndex === index
          ? {
              ...link,
              [field]: value,
            }
          : link
      )
    )
  }

  const removeResponseLink = (
    index: number
  ) => {
    setResponseLinks((previous) =>
      previous.filter(
        (_, linkIndex) =>
          linkIndex !== index
      )
    )
  }

  const validateResponseLinks = () => {
    for (
      let index = 0;
      index < responseLinks.length;
      index++
    ) {
      const link =
        responseLinks[index]

      const hasName =
        link.name.trim().length > 0

      const hasUrl =
        link.url.trim().length > 0

      // Completely empty row is ignored.
      if (!hasName && !hasUrl) {
        continue
      }

      if (!hasName) {
        throw new Error(
          `Please enter a name for response link ${index + 1}.`
        )
      }

      if (!hasUrl) {
        throw new Error(
          `Please enter a URL for response link ${index + 1}.`
        )
      }

      if (
        !isValidHttpUrl(
          link.url.trim()
        )
      ) {
        throw new Error(
          `Response link ${index + 1} must be a valid http:// or https:// URL.`
        )
      }
    }

    return responseLinks
      .filter(
        (link) =>
          link.name.trim() &&
          link.url.trim()
      )
      .map((link) => ({
        name: link.name.trim(),
        url: link.url.trim(),
      }))
  }

  // ---------------------------------------------------------------------------
  // Load Page
  // ---------------------------------------------------------------------------

  async function loadPage() {
    setLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // -----------------------------------------------------------------------
      // Auth User
      // -----------------------------------------------------------------------

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser()

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "You are not logged in. Please sign in again."
        )
      }

      // -----------------------------------------------------------------------
      // Staff
      // -----------------------------------------------------------------------

      const {
        data: staffRow,
        error: staffError,
      } =
        await supabase
          .from("staff")
          .select("*")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle()

      if (staffError) {
        throw staffError
      }

      if (!staffRow) {
        throw new Error(
          "No staff profile is linked to this login."
        )
      }

      const currentStaff =
        staffRow as Staff

      setStaff(
        currentStaff
      )

      // -----------------------------------------------------------------------
      // Task
      // -----------------------------------------------------------------------

      const {
        data: taskRow,
        error: taskError,
      } =
        await supabase
          .from("tasks")
          .select("*")
          .eq(
            "id",
            taskId
          )
          .maybeSingle()

      if (taskError) {
        throw taskError
      }

      if (!taskRow) {
        throw new Error(
          "Task not found."
        )
      }

      const currentTask: Task = {
        ...(taskRow as Task),
        task_links:
          normalizeLinks(
            taskRow.task_links
          ),
      }

      setTask(
        currentTask
      )

      // -----------------------------------------------------------------------
      // Class
      // -----------------------------------------------------------------------

      const {
        data: classRow,
        error: classError,
      } =
        await supabase
          .from("classes")
          .select("*")
          .eq(
            "id",
            classId
          )
          .maybeSingle()

      if (classError) {
        throw classError
      }

      if (!classRow) {
        throw new Error(
          "Class not found."
        )
      }

      const currentClass =
        classRow as ClassRow

      setClassData(
        currentClass
      )

      // -----------------------------------------------------------------------
      // Verify Task Class
      // -----------------------------------------------------------------------

      const {
        data: taskClassLink,
        error:
          taskClassLinkError,
      } =
        await supabase
          .from("task_classes")
          .select(
            "task_id, class_id"
          )
          .eq(
            "task_id",
            taskId
          )
          .eq(
            "class_id",
            classId
          )
          .maybeSingle()

      if (
        taskClassLinkError
      ) {
        throw taskClassLinkError
      }

      // -----------------------------------------------------------------------
      // Specific class task
      // -----------------------------------------------------------------------

      if (
        !currentTask
          .applies_to_all_classes &&
        !taskClassLink
      ) {
        throw new Error(
          "This class is not assigned to this task."
        )
      }

      // -----------------------------------------------------------------------
      // All classes task
      // -----------------------------------------------------------------------

      if (
        currentTask
          .applies_to_all_classes
      ) {
        if (
          currentTask.target_years &&
          currentTask.target_years.length >
            0 &&
          !currentTask.target_years.includes(
            Number(
              currentClass.year
            )
          )
        ) {
          throw new Error(
            "This task does not apply to this class."
          )
        }

        if (
          currentClass.department.toLowerCase() !==
          currentTask.department.toLowerCase()
        ) {
          throw new Error(
            "This class belongs to a different department."
          )
        }
      }

      // -----------------------------------------------------------------------
      // Load Progress
      // -----------------------------------------------------------------------

      const {
        data: progressRow,
        error:
          progressError,
      } =
        await supabase
          .from(
            "task_class_progress"
          )
          .select("*")
          .eq(
            "task_id",
            taskId
          )
          .eq(
            "class_id",
            classId
          )
          .maybeSingle()

      if (progressError) {
        console.warn(
          "Could not load progress:",
          progressError.message
        )
      }

      const currentProgress =
        progressRow
          ? ({
              ...(progressRow as TaskClassProgress),
              response_links:
                normalizeLinks(
                  progressRow.response_links
                ),
            } as TaskClassProgress)
          : null

      setProgress(
        currentProgress
      )

      // -----------------------------------------------------------------------
      // Fill Form
      // -----------------------------------------------------------------------

      setStudentQuestion(
        currentProgress
          ?.student_question ||
          ""
      )

      setStudentResponse(
        currentProgress
          ?.student_response ||
          ""
      )

      setStaffNote(
        currentProgress
          ?.staff_note ||
          ""
      )

      setResponseRequired(
        Boolean(
          currentProgress?.response_required
        )
      )

      setResponseLinks(
        currentProgress?.response_links ||
          []
      )

      // -----------------------------------------------------------------------
      // HOD Security Check
      // -----------------------------------------------------------------------

      if (
        currentStaff.role ===
          "HOD" &&
        currentProgress?.status !==
          "Done"
      ) {
        throw new Error(
          "This class task has not been completed by staff yet."
        )
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load task details."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (
      !taskId ||
      !classId
    ) {
      setError(
        "Invalid task or class."
      )
      setLoading(false)
      return
    }

    loadPage()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    taskId,
    classId,
  ])

  // ---------------------------------------------------------------------------
  // Start Task
  // ---------------------------------------------------------------------------

  const handleStartTask =
    async () => {
      if (
        !staff ||
        isHod
      ) {
        return
      }

      setSaving(true)
      setError(null)
      setSuccess(null)

      try {
        const supabase =
          createClient()

        if (progress) {
          const {
            data: updated,
            error:
              updateError,
          } =
            await supabase
              .from(
                "task_class_progress"
              )
              .update({
                status:
                  "In Progress",
                started_at:
                  progress.started_at ||
                  new Date().toISOString(),
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                progress.id
              )
              .select()
              .single()

          if (updateError) {
            throw updateError
          }

          setProgress(
            {
              ...(updated as TaskClassProgress),
              response_links:
                normalizeLinks(
                  updated.response_links
                ),
            }
          )
        } else {
          const {
            data: inserted,
            error:
              insertError,
          } =
            await supabase
              .from(
                "task_class_progress"
              )
              .insert({
                task_id: taskId,
                class_id:
                  classId,
                status:
                  "In Progress",
                response_required:
                  false,
                student_question:
                  null,
                student_response:
                  null,
                response_document_url:
                  null,
                response_links:
                  [],
                staff_note:
                  null,
                started_at:
                  new Date().toISOString(),
                completed_at:
                  null,
              })
              .select()
              .single()

          if (insertError) {
            throw insertError
          }

          setProgress(
            {
              ...(inserted as TaskClassProgress),
              response_links:
                normalizeLinks(
                  inserted.response_links
                ),
            }
          )
        }

        setSuccess(
          "Task started successfully."
        )
      } catch (err: any) {
        setError(
          err?.message ||
            "Failed to start task."
        )
      } finally {
        setSaving(false)
      }
    }

  // ---------------------------------------------------------------------------
  // Save Progress
  // ---------------------------------------------------------------------------

  const handleSaveProgress =
    async () => {
      if (
        !staff ||
        isHod
      ) {
        return
      }

      setSaving(true)
      setError(null)
      setSuccess(null)

      try {
        const supabase =
          createClient()

        // ---------------------------------------------------------------------
        // Validate response
        // ---------------------------------------------------------------------

        if (
          responseRequired &&
          !studentResponse.trim()
        ) {
          throw new Error(
            "Student response is required."
          )
        }

        // ---------------------------------------------------------------------
        // Validate links
        // ---------------------------------------------------------------------

        const validResponseLinks =
          validateResponseLinks()

        // ---------------------------------------------------------------------
        // Make sure progress exists
        // ---------------------------------------------------------------------

        let progressId =
          progress?.id

        if (!progressId) {
          const {
            data: inserted,
            error:
              insertError,
          } =
            await supabase
              .from(
                "task_class_progress"
              )
              .insert({
                task_id: taskId,
                class_id:
                  classId,
                status:
                  "In Progress",
                response_required:
                  responseRequired,
                student_question:
                  studentQuestion.trim() ||
                  null,
                student_response:
                  studentResponse.trim() ||
                  null,
                response_document_url:
                  null,
                response_links:
                  validResponseLinks,
                staff_note:
                  staffNote.trim() ||
                  null,
                started_at:
                  new Date().toISOString(),
                completed_at:
                  null,
              })
              .select()
              .single()

          if (insertError) {
            throw insertError
          }

          progressId =
            inserted.id

          const updatedProgress =
            {
              ...(inserted as TaskClassProgress),
              response_links:
                normalizeLinks(
                  inserted.response_links
                ),
            }

          setProgress(
            updatedProgress
          )
        } else {
          const {
            data: updated,
            error:
              updateError,
          } =
            await supabase
              .from(
                "task_class_progress"
              )
              .update({
                response_required:
                  responseRequired,

                student_question:
                  studentQuestion.trim() ||
                  null,

                student_response:
                  studentResponse.trim() ||
                  null,

                response_document_url:
                  null,

                response_links:
                  validResponseLinks,

                staff_note:
                  staffNote.trim() ||
                  null,

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                progressId
              )
              .select()
              .single()

          if (updateError) {
            throw updateError
          }

          setProgress(
            {
              ...(updated as TaskClassProgress),
              response_links:
                normalizeLinks(
                  updated.response_links
                ),
            }
          )
        }

        setResponseLinks(
          validResponseLinks
        )

        setSuccess(
          "Progress saved successfully."
        )
      } catch (err: any) {
        setError(
          err?.message ||
            "Failed to save progress."
        )
      } finally {
        setSaving(false)
      }
    }

  // ---------------------------------------------------------------------------
  // Mark Done
  // ---------------------------------------------------------------------------

  const handleMarkDone =
    async () => {
      if (
        !staff ||
        isHod
      ) {
        return
      }

      if (
        responseRequired &&
        !studentResponse.trim()
      ) {
        setError(
          "Please enter the student response before marking the task as Done."
        )
        return
      }

      let validResponseLinks: TaskLink[] = []

      try {
        validResponseLinks =
          validateResponseLinks()
      } catch (err: any) {
        setError(
          err?.message ||
            "Please check the response links."
        )
        return
      }

      const confirmed =
        confirm(
          "Mark this class task as completed?"
        )

      if (!confirmed) {
        return
      }

      setSaving(true)
      setError(null)
      setSuccess(null)

      try {
        const supabase =
          createClient()

        let progressId =
          progress?.id

        if (!progressId) {
          const {
            data: inserted,
            error:
              insertError,
          } =
            await supabase
              .from(
                "task_class_progress"
              )
              .insert({
                task_id: taskId,
                class_id:
                  classId,
                status: "Done",
                response_required:
                  responseRequired,
                student_question:
                  studentQuestion.trim() ||
                  null,
                student_response:
                  studentResponse.trim() ||
                  null,
                response_document_url:
                  null,
                response_links:
                  validResponseLinks,
                staff_note:
                  staffNote.trim() ||
                  null,
                started_at:
                  new Date().toISOString(),
                completed_at:
                  new Date().toISOString(),
              })
              .select()
              .single()

          if (insertError) {
            throw insertError
          }

          setProgress(
            {
              ...(inserted as TaskClassProgress),
              response_links:
                normalizeLinks(
                  inserted.response_links
                ),
            }
          )
        } else {
          const {
            data: updated,
            error:
              updateError,
          } =
            await supabase
              .from(
                "task_class_progress"
              )
              .update({
                status: "Done",

                response_required:
                  responseRequired,

                student_question:
                  studentQuestion.trim() ||
                  null,

                student_response:
                  studentResponse.trim() ||
                  null,

                response_document_url:
                  null,

                response_links:
                  validResponseLinks,

                staff_note:
                  staffNote.trim() ||
                  null,

                completed_at:
                  new Date().toISOString(),

                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                progressId
              )
              .select()
              .single()

          if (updateError) {
            throw updateError
          }

          setProgress(
            {
              ...(updated as TaskClassProgress),
              response_links:
                normalizeLinks(
                  updated.response_links
                ),
            }
          )
        }

        setResponseLinks(
          validResponseLinks
        )

        setSuccess(
          "Task completed successfully."
        )
      } catch (err: any) {
        setError(
          err?.message ||
            "Failed to complete task."
        )
      } finally {
        setSaving(false)
      }
    }

  // ---------------------------------------------------------------------------
  // Format Date
  // ---------------------------------------------------------------------------

  const formatDate = (
    date: string | null
  ) => {
    if (!date) {
      return "No due date"
    }

    return new Date(
      date
    ).toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    )
  }

  // ---------------------------------------------------------------------------
  // Status Badge
  // ---------------------------------------------------------------------------

  const StatusBadge = ({
    status,
  }: {
    status: ProgressStatus
  }) => {
    if (
      status === "Done"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completed
        </span>
      )
    }

    if (
      status ===
      "In Progress"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
          <Clock3 className="h-3.5 w-3.5" />
          In Progress
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <Clock3 className="h-3.5 w-3.5" />
        Pending
      </span>
    )
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <DashboardLayout
        userRole="Staff"
        userName="Loading..."
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------

  if (
    error &&
    (!task ||
      !classData)
  ) {
    return (
      <DashboardLayout
        userRole={
          staff?.role ||
          "Staff"
        }
        userName={
          staff?.name ||
          "Staff"
        }
      >
        <div className="flex flex-col gap-6">

          <Button
            variant="ghost"
            className="w-fit gap-2"
            onClick={() =>
              router.push(
                "/dashboard/staff/task"
              )
            }
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Button>

          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="flex items-start gap-3 py-6 text-red-600 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />

              <div>
                <p className="font-medium">
                  Unable to open this task
                </p>

                <p className="mt-1 text-sm">
                  {error}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (
    !task ||
    !classData
  ) {
    return null
  }

  // ---------------------------------------------------------------------------
  // Current Status
  // ---------------------------------------------------------------------------

  const currentStatus: ProgressStatus =
    progress?.status ||
    "Pending"

  // ---------------------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout
      userRole={
        staff?.role ||
        "Staff"
      }
      userName={
        staff?.name ||
        "Staff"
      }
    >
      <div className="flex flex-col gap-6 pb-12">

        {/* ----------------------------------------------------------------- */}
        {/* Back */}
        {/* ----------------------------------------------------------------- */}

        <Button
          variant="ghost"
          className="w-fit gap-2"
          onClick={() =>
            router.push(
              "/dashboard/staff/task"
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tasks
        </Button>

        {/* ----------------------------------------------------------------- */}
        {/* Error */}
        {/* ----------------------------------------------------------------- */}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />

            <span>
              {error}
            </span>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Success */}
        {/* ----------------------------------------------------------------- */}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />

            <span>
              {success}
            </span>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Header */}
        {/* ----------------------------------------------------------------- */}

        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

            <div className="flex min-w-0 items-start gap-3">

              <div className="rounded-xl bg-blue-100 p-3 dark:bg-blue-950/40">
                <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>

              <div className="min-w-0">

                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Class Task
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {task.title}
                </h1>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {classLabel(
                    classData
                  )}
                </p>
              </div>
            </div>

            <StatusBadge
              status={
                currentStatus
              }
            />
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Task Information */}
        {/* ----------------------------------------------------------------- */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* Class */}

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                <ClipboardList className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Class
                </p>

                <p className="text-sm font-semibold">
                  {classLabel(
                    classData
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Year */}

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                <CalendarDays className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Year / Section
                </p>

                <p className="text-sm font-semibold">
                  Year{" "}
                  {classData.year}

                  {classData.section
                    ? ` · Section ${classData.section}`
                    : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Due Date */}

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                <CalendarDays className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Due Date
                </p>

                <p className="text-sm font-semibold">
                  {formatDate(
                    task.due_date
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Task Description */}
        {/* ----------------------------------------------------------------- */}

        {task.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Task Description
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">
                {task.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Task Links */}
        {/* ----------------------------------------------------------------- */}

        {task.task_links &&
          task.task_links.length >
            0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950/40">
                    <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>

                  <div>
                    <CardTitle className="text-base">
                      Task Links
                    </CardTitle>

                    <CardDescription>
                      Resources and links provided for this task.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  {task.task_links.map(
                    (
                      link,
                      index
                    ) => (
                      <a
                        key={`${link.url}-${index}`}
                        href={
                          link.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <div className="rounded-md bg-gray-100 p-2 dark:bg-gray-800">
                          <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {
                              link.name
                            }
                          </p>

                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {
                              link.url
                            }
                          </p>
                        </div>

                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          Open
                        </span>
                      </a>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        {/* ----------------------------------------------------------------- */}
        {/* HOD Completed Review */}
        {/* ----------------------------------------------------------------- */}

        {isHod &&
          isCompleted && (
            <Card className="border-green-200 dark:border-green-900">

              <CardHeader>
                <div className="flex items-center gap-3">

                  <div className="rounded-lg bg-green-100 p-2 dark:bg-green-950/40">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>

                  <div>
                    <CardTitle>
                      Completed Task Review
                    </CardTitle>

                    <CardDescription>
                      Staff has completed this
                      class task. The information
                      below is read-only.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">

                {/* Student Question */}

                <div className="space-y-2">
                  <Label>
                    Student Question
                  </Label>

                  <div className="rounded-lg border bg-gray-50 p-4 text-sm dark:bg-gray-900">
                    {
                      progress?.student_question ||
                      "No student question entered."
                    }
                  </div>
                </div>

                {/* Student Response */}

                <div className="space-y-2">
                  <Label>
                    Student Response
                  </Label>

                  <div className="whitespace-pre-wrap rounded-lg border bg-gray-50 p-4 text-sm dark:bg-gray-900">
                    {
                      progress?.student_response ||
                      "No student response entered."
                    }
                  </div>
                </div>

                {/* Staff Note */}

                <div className="space-y-2">
                  <Label>
                    Staff Note
                  </Label>

                  <div className="whitespace-pre-wrap rounded-lg border bg-gray-50 p-4 text-sm dark:bg-gray-900">
                    {
                      progress?.staff_note ||
                      "No staff note added."
                    }
                  </div>
                </div>

                {/* Response Links */}

                <div className="space-y-2">
                  <Label>
                    Response Links
                  </Label>

                  {progress?.response_links &&
                  progress.response_links.length >
                    0 ? (
                    <div className="space-y-2">
                      {progress.response_links.map(
                        (
                          link,
                          index
                        ) => (
                          <a
                            key={`${link.url}-${index}`}
                            href={
                              link.url
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Link2 className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {
                                  link.name
                                }
                              </p>

                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {
                                  link.url
                                }
                              </p>
                            </div>

                            <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          </a>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      No response links added.
                    </div>
                  )}
                </div>

                {/* Completed Date */}

                {progress?.completed_at && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />

                    Completed on{" "}
                    {new Date(
                      progress.completed_at
                    ).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        {/* ----------------------------------------------------------------- */}
        {/* Staff Workflow */}
        {/* ----------------------------------------------------------------- */}

        {!isHod && (
          <Card>

            <CardHeader>
              <div className="flex items-center justify-between gap-4">

                <div>
                  <CardTitle>
                    Work on Task
                  </CardTitle>

                  <CardDescription>
                    Update the student response,
                    add useful links and manage
                    task progress for this class.
                  </CardDescription>
                </div>

                <StatusBadge
                  status={
                    currentStatus
                  }
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-6">

              {/* ----------------------------------------------------------- */}
              {/* Pending */}
              {/* ----------------------------------------------------------- */}

              {currentStatus ===
                "Pending" && (
                <div className="rounded-lg border border-dashed p-6 text-center">

                  <Clock3 className="mx-auto h-8 w-8 text-gray-400" />

                  <h3 className="mt-3 text-sm font-semibold">
                    This task has not been started
                  </h3>

                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Start working on this class
                    to enter the student response
                    and other details.
                  </p>

                  <Button
                    className="mt-4 gap-2"
                    disabled={
                      saving
                    }
                    onClick={
                      handleStartTask
                    }
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Clock3 className="h-4 w-4" />
                    )}

                    Start Task
                  </Button>
                </div>
              )}

              {/* ----------------------------------------------------------- */}
              {/* Form */}
              {/* ----------------------------------------------------------- */}

              {(currentStatus ===
                "In Progress" ||
                currentStatus ===
                  "Done") && (
                <>
                  {/* Response Required */}

                  <div className="flex items-start gap-3 rounded-lg border bg-gray-50 p-4 dark:bg-gray-900">

                    <input
                      id="response-required"
                      type="checkbox"
                      checked={
                        responseRequired
                      }
                      onChange={(e) =>
                        setResponseRequired(
                          e.target
                            .checked
                        )
                      }
                      disabled={
                        currentStatus ===
                        "Done"
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />

                    <div>
                      <Label
                        htmlFor="response-required"
                        className="cursor-pointer"
                      >
                        Student response
                        is required
                      </Label>

                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Enable this if the
                        student has provided a
                        question that requires a
                        response.
                      </p>
                    </div>
                  </div>

                  {/* Student Question */}

                  <div className="space-y-2">
                    <Label htmlFor="student-question">
                      Student Question
                    </Label>

                    <Textarea
                      id="student-question"
                      placeholder="Enter the question raised by the student..."
                      value={
                        studentQuestion
                      }
                      onChange={(e) =>
                        setStudentQuestion(
                          e.target
                            .value
                        )
                      }
                      disabled={
                        currentStatus ===
                        "Done"
                      }
                      rows={4}
                    />
                  </div>

                  {/* Student Response */}

                  <div className="space-y-2">
                    <Label htmlFor="student-response">
                      Student Response
                      {responseRequired && (
                        <span className="ml-1 text-red-500">
                          *
                        </span>
                      )}
                    </Label>

                    <Textarea
                      id="student-response"
                      placeholder="Enter the response given to the student..."
                      value={
                        studentResponse
                      }
                      onChange={(e) =>
                        setStudentResponse(
                          e.target
                            .value
                        )
                      }
                      disabled={
                        currentStatus ===
                        "Done"
                      }
                      rows={6}
                    />
                  </div>

                  {/* Staff Note */}

                  <div className="space-y-2">
                    <Label htmlFor="staff-note">
                      Staff Note
                    </Label>

                    <Textarea
                      id="staff-note"
                      placeholder="Add any additional notes about this task..."
                      value={
                        staffNote
                      }
                      onChange={(e) =>
                        setStaffNote(
                          e.target
                            .value
                        )
                      }
                      disabled={
                        currentStatus ===
                        "Done"
                      }
                      rows={4}
                    />
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Response Links */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-3">

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>
                          Response Links
                        </Label>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Add links to the work, report,
                          project, form or other resources.
                        </p>
                      </div>

                      {currentStatus !==
                        "Done" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={
                            addResponseLink
                          }
                          disabled={
                            saving
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Add Link
                        </Button>
                      )}
                    </div>

                    {responseLinks.length ===
                      0 && (
                      <div className="rounded-lg border border-dashed p-5 text-center">
                        <Link2 className="mx-auto h-7 w-7 text-gray-400" />

                        <p className="mt-2 text-sm font-medium">
                          No response links
                        </p>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Add one or more links if
                          you need to share work or
                          supporting resources.
                        </p>

                        {currentStatus !==
                          "Done" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-3 gap-2"
                            onClick={
                              addResponseLink
                            }
                            disabled={
                              saving
                            }
                          >
                            <Plus className="h-4 w-4" />
                            Add First Link
                          </Button>
                        )}
                      </div>
                    )}

                    {responseLinks.map(
                      (
                        link,
                        index
                      ) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-900"
                        >
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">

                            <div className="space-y-2">
                              <Label
                                htmlFor={`response-link-name-${index}`}
                              >
                                Link Name
                              </Label>

                              <Input
                                id={`response-link-name-${index}`}
                                placeholder="Example: Project Repository"
                                value={
                                  link.name
                                }
                                onChange={(e) =>
                                  updateResponseLink(
                                    index,
                                    "name",
                                    e.target
                                      .value
                                  )
                                }
                                disabled={
                                  currentStatus ===
                                  "Done"
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor={`response-link-url-${index}`}
                              >
                                Link URL
                              </Label>

                              <Input
                                id={`response-link-url-${index}`}
                                type="url"
                                placeholder="https://..."
                                value={
                                  link.url
                                }
                                onChange={(e) =>
                                  updateResponseLink(
                                    index,
                                    "url",
                                    e.target
                                      .value
                                  )
                                }
                                disabled={
                                  currentStatus ===
                                  "Done"
                                }
                              />
                            </div>

                            {currentStatus !==
                              "Done" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                                onClick={() =>
                                  removeResponseLink(
                                    index
                                  )
                                }
                                disabled={
                                  saving
                                }
                                title="Remove link"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    )}

                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Only http:// and https:// links
                      are accepted.
                    </p>
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Actions */}
                  {/* ------------------------------------------------------- */}

                  {currentStatus ===
                    "In Progress" && (
                    <div className="flex flex-col gap-3 border-t pt-5 dark:border-gray-800 sm:flex-row sm:justify-end">

                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          saving
                        }
                        onClick={
                          handleSaveProgress
                        }
                        className="gap-2"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}

                        Save Progress
                      </Button>

                      <Button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={
                          handleMarkDone
                        }
                        className="gap-2"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}

                        Mark as Done
                      </Button>
                    </div>
                  )}

                  {/* ------------------------------------------------------- */}
                  {/* Completed Staff State */}
                  {/* ------------------------------------------------------- */}

                  {currentStatus ===
                    "Done" && (
                    <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />

                      <div>
                        <p className="font-medium">
                          Task completed
                        </p>

                        {progress?.completed_at && (
                          <p className="mt-1 text-xs">
                            Completed on{" "}
                            {new Date(
                              progress.completed_at
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* HOD Locked Message */}
        {/* ----------------------------------------------------------------- */}

        {isHod &&
          !isCompleted && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <CardContent className="flex items-start gap-3 py-5 text-sm text-amber-700 dark:text-amber-400">
                <Lock className="mt-0.5 h-5 w-5 flex-shrink-0" />

                <div>
                  <p className="font-medium">
                    Task not completed yet
                  </p>

                  <p className="mt-1">
                    You can review this class
                    only after the assigned staff
                    member marks the task as Done.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </DashboardLayout>
  )
}