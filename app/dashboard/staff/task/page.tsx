"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

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
import { Checkbox } from "@/components/ui/checkbox"

import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Class } from "@/types"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

type ClassRow = Class & {
  class_name?: string | null
  tutor_id?: string | null
  advisor_id?: string | null
}

type ProgressStatus = "Pending" | "In Progress" | "Done"

type TaskClassProgress = {
  id: string
  task_id: string
  class_id: string
  status: ProgressStatus
  response_required: boolean
  student_question: string | null
  student_response: string | null
  response_document_url: string | null
  staff_note: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

type TaskLink = {
  title: string
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
  task_links: TaskLink[]

  task_classes?: {
    class_id: string
    classes: ClassRow | null
  }[]

  task_class_progress?: TaskClassProgress[]
}

// Shape of a task row exactly as it comes back from Supabase, before
// task_links has been normalized into TaskLink[].
type RawTaskRow = Omit<Task, "task_links"> & { task_links: unknown }

// Shape of a class_staff row as selected below (just the FK we need).
type ClassAssignmentRow = { class_id: string }

type ClassScope = "all" | "specific"

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeTaskLinks(value: unknown): TaskLink[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item) => {
      return (
        item &&
        typeof item === "object" &&
        typeof (item as TaskLink).url === "string"
      )
    })
    .map((item) => {
      const link = item as Partial<TaskLink>

      return {
        title:
          typeof link.title === "string"
            ? link.title.trim()
            : "Link",
        url:
          typeof link.url === "string"
            ? link.url.trim()
            : "",
      }
    })
    .filter((link) => link.url.length > 0)
}

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

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function TaskPage() {
  const router = useRouter()

  const [staff, setStaff] = useState<Staff | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  // The classes THIS staff member is actually assigned to, via
  // class_staff. Empty for HOD — HOD's visibility isn't restricted to a
  // class list, they see everything in the department. For everyone else,
  // this is the set that narrows every task down to "your class(es) only".
  const [myClassIds, setMyClassIds] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  // ---------------------------------------------------------------------------
  // Create Task Dialog
  // ---------------------------------------------------------------------------

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")

  const [applyAllYears, setApplyAllYears] = useState(true)
  const [selectedYears, setSelectedYears] = useState<number[]>([])

  const [classScope, setClassScope] =
    useState<ClassScope>("all")

  const [selectedClassIds, setSelectedClassIds] =
    useState<string[]>([])

  // ---------------------------------------------------------------------------
  // Task Links
  // ---------------------------------------------------------------------------

  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([])

  const isHod = staff?.role === "HOD"

  // ---------------------------------------------------------------------------
  // Load Data
  // ---------------------------------------------------------------------------
  //
  // `cancelled` lets the effect below tell this run "the component has
  // unmounted (or a newer run has started), stop touching state" — every
  // setState call after an await is guarded by it, which is the standard
  // fix for the classic "setState called after unmount" issue.

  async function loadData(cancelled: () => boolean) {
    setError(null)

    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (cancelled()) return

    if (userError || !user) {
      setError(
        "You are not logged in. Please sign in again."
      )
      setLoading(false)
      return
    }

    // -------------------------------------------------------------------------
    // Load Staff
    // -------------------------------------------------------------------------

    const {
      data: staffRow,
      error: staffError,
    } = await supabase
      .from("staff")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (cancelled()) return

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

    // -------------------------------------------------------------------------
    // Load Classes (full department list — used for the HOD create-task
    // dialog's year/class pickers regardless of who's viewing)
    // -------------------------------------------------------------------------

    const {
      data: classRows,
      error: classesError,
    } = await supabase
      .from("classes")
      .select("*")
      .ilike("department", staffRow.department)
      .order("year", { ascending: true })
      .order("section", { ascending: true })

    if (cancelled()) return

    if (classesError) {
      setError(classesError.message)
      setLoading(false)
      return
    }

    const loadedClasses =
      (classRows || []) as ClassRow[]

    setClasses(loadedClasses)

    // -------------------------------------------------------------------------
    // Load THIS staff member's own class assignments. HOD isn't scoped to
    // a class list at all, so this stays empty for them and is simply
    // never consulted. Everyone else (Teacher / Tutor / Class Advisor)
    // only ever sees their own class(es) on this page from here on.
    // -------------------------------------------------------------------------

    let resolvedMyClassIds: string[] = []

    if (staffRow.role !== "HOD") {
      const {
        data: assignmentRows,
        error: assignmentError,
      } = await supabase
        .from("class_staff")
        .select("class_id")
        .eq("staff_id", staffRow.id)

      if (cancelled()) return

      if (assignmentError) {
        console.warn(
          "Could not load class assignments:",
          assignmentError.message
        )
      } else {
        resolvedMyClassIds = (
          (assignmentRows || []) as ClassAssignmentRow[]
        ).map((row) => row.class_id)
      }
    }

    setMyClassIds(resolvedMyClassIds)

    // -------------------------------------------------------------------------
    // Load Tasks
    // -------------------------------------------------------------------------

    const {
      data: taskRows,
      error: tasksError,
    } = await supabase
      .from("tasks")
      .select(`
        *,
        task_classes(
          class_id,
          classes(*)
        )
      `)
      .eq("department", staffRow.department)
      .order("due_date", {
        ascending: true,
      })

    if (cancelled()) return

    if (tasksError) {
      setError(tasksError.message)
      setLoading(false)
      return
    }

    const loadedTasks =
      ((taskRows || []) as RawTaskRow[]).map(
        (task) => ({
          ...task,
          task_links: normalizeTaskLinks(
            task.task_links
          ),
        })
      ) as Task[]

    // -------------------------------------------------------------------------
    // Load Progress
    // -------------------------------------------------------------------------

    if (loadedTasks.length > 0) {
      const taskIds =
        loadedTasks.map(
          (task) => task.id
        )

      const {
        data: progressRows,
        error: progressError,
      } = await supabase
        .from("task_class_progress")
        .select("*")
        .in("task_id", taskIds)

      if (cancelled()) return

      if (progressError) {
        console.warn(
          "Could not load task progress:",
          progressError.message
        )

        const tasksWithoutProgress =
          loadedTasks.map(
            (task) => ({
              ...task,
              task_class_progress: [],
            })
          )

        setTasks(
          tasksWithoutProgress
        )
      } else {
        const progress =
          (progressRows || []) as TaskClassProgress[]

        const tasksWithProgress =
          loadedTasks.map(
            (task) => ({
              ...task,
              task_class_progress:
                progress.filter(
                  (item) =>
                    item.task_id ===
                    task.id
                ),
            })
          )

        setTasks(
          tasksWithProgress
        )
      }
    } else {
      setTasks([])
    }

    setLoading(false)
  }

  // Fetch-on-mount: the standard "load once when the page opens" pattern.
  //
  // React's set-state-in-effect diagnostic ("Calling setState synchronously
  // within an effect can trigger cascading renders") fires whenever a
  // setState call is reachable synchronously from the effect body — and
  // loadData calls setError(null) before its very first await, so calling
  // it directly here tripped that check even though this is exactly the
  // documented "sync with an external system on mount" use case for
  // useEffect.
  //
  // The fix: defer the call to a microtask so no setState runs
  // synchronously within the effect's own call stack, and thread a
  // `cancelled` check through loadData so it stops updating state if the
  // component unmounts (or React re-runs the effect) before it finishes —
  // which also fixes the unrelated "setState after unmount" class of bug.
  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) {
        loadData(() => cancelled)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Years
  // ---------------------------------------------------------------------------

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          classes
            .map((c) => Number(c.year))
            .filter(
              (y) =>
                !Number.isNaN(y)
            )
        )
      ).sort(
        (a, b) => a - b
      ),
    [classes]
  )

  // ---------------------------------------------------------------------------
  // Class Label
  // ---------------------------------------------------------------------------

  const classLabel = (
    c: ClassRow
  ) => {
    if (c.class_name) {
      return c.class_name
    }

    if (c.name) {
      return c.name
    }

    return `Y${c.year} · Section ${
      c.section || "-"
    }`
  }

  // ---------------------------------------------------------------------------
  // Available Classes For Create Task
  // ---------------------------------------------------------------------------

  const availableClasses =
    useMemo(
      () =>
        applyAllYears
          ? classes
          : classes.filter(
              (c) =>
                selectedYears.includes(
                  Number(c.year)
                )
            ),
      [
        classes,
        applyAllYears,
        selectedYears,
      ]
    )

  // ---------------------------------------------------------------------------
  // Valid Selected Classes (derived, not synced)
  //
  // Previously this pruned selectedClassIds via a useEffect + setState
  // whenever availableClasses changed -- exactly the "derive state in an
  // effect" pattern React's set-state-in-effect rule flags. Instead this
  // is computed at render time: selectedClassIds itself is left alone
  // (harmless if it holds a stale id, since that id simply won't render
  // as a checkbox any more), and every place that NEEDS the pruned list
  // -- validation and submission -- reads this derived value instead.
  // ---------------------------------------------------------------------------

  const validSelectedClassIds = useMemo(
    () =>
      selectedClassIds.filter((id) =>
        availableClasses.some((c) => c.id === id)
      ),
    [selectedClassIds, availableClasses]
  )

  // ---------------------------------------------------------------------------
  // Toggle Year
  // ---------------------------------------------------------------------------

  const toggleYear = (
    year: number
  ) => {
    setSelectedYears(
      (prev) =>
        prev.includes(year)
          ? prev.filter(
              (y) => y !== year
            )
          : [...prev, year]
    )
  }

  // ---------------------------------------------------------------------------
  // Toggle Class
  // ---------------------------------------------------------------------------

  const toggleClass = (
    classId: string
  ) => {
    setSelectedClassIds(
      (prev) =>
        prev.includes(classId)
          ? prev.filter(
              (id) =>
                id !== classId
            )
          : [
              ...prev,
              classId,
            ]
    )
  }

  // ---------------------------------------------------------------------------
  // Add Task Link
  // ---------------------------------------------------------------------------

  const addTaskLink = () => {
    setTaskLinks(
      (prev) => [
        ...prev,
        {
          title: "",
          url: "",
        },
      ]
    )
  }

  // ---------------------------------------------------------------------------
  // Update Task Link
  // ---------------------------------------------------------------------------

  const updateTaskLink = (
    index: number,
    field: keyof TaskLink,
    value: string
  ) => {
    setTaskLinks(
      (prev) =>
        prev.map(
          (link, i) =>
            i === index
              ? {
                  ...link,
                  [field]:
                    value,
                }
              : link
        )
    )
  }

  // ---------------------------------------------------------------------------
  // Remove Task Link
  // ---------------------------------------------------------------------------

  const removeTaskLink = (
    index: number
  ) => {
    setTaskLinks(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    )
  }

  // ---------------------------------------------------------------------------
  // Reset Form
  // ---------------------------------------------------------------------------

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setDueDate("")

    setApplyAllYears(true)
    setSelectedYears([])

    setClassScope("all")
    setSelectedClassIds([])

    setTaskLinks([])

    setFormError(null)
  }

  const handleDialogOpenChange = (
    open: boolean
  ) => {
    setDialogOpen(open)

    if (!open) {
      resetForm()
    }
  }

  // ---------------------------------------------------------------------------
  // Get Classes Covered By Task (the task's full scope, as defined when it
  // was created — NOT yet filtered down to any one viewer's classes)
  // ---------------------------------------------------------------------------

  const getTaskClasses = (
    task: Task
  ): ClassRow[] => {
    // Specific classes
    if (
      !task.applies_to_all_classes
    ) {
      return (
        task.task_classes || []
      )
        .map(
          (tc) =>
            tc.classes
        )
        .filter(
          (
            c
          ): c is ClassRow =>
            Boolean(c)
        )
    }

    // All classes, specific years
    if (
      task.target_years &&
      task.target_years.length >
        0
    ) {
      return classes.filter(
        (c) =>
          task.target_years!.includes(
            Number(c.year)
          )
      )
    }

    // All classes in department
    return classes
  }

  // ---------------------------------------------------------------------------
  // Get Classes Visible To The Current Viewer
  //
  // This is the actual fix: HOD sees the task's full scope (every class it
  // targets). Everyone else only ever sees the intersection of that scope
  // with their own class_staff assignments — never the whole department's
  // classes for a task that happens to be department-wide.
  // ---------------------------------------------------------------------------

  const getVisibleTaskClasses = (
    task: Task
  ): ClassRow[] => {
    const taskClasses = getTaskClasses(task)

    if (isHod) {
      return taskClasses
    }

    return taskClasses.filter((c) =>
      myClassIds.includes(c.id)
    )
  }

  // ---------------------------------------------------------------------------
  // Get Progress For Class
  // ---------------------------------------------------------------------------

  const getClassProgress = (
    task: Task,
    classId: string
  ): TaskClassProgress | null => {
    return (
      task.task_class_progress?.find(
        (progress) =>
          progress.class_id ===
          classId
      ) || null
    )
  }

  // ---------------------------------------------------------------------------
  // Status Helper
  // ---------------------------------------------------------------------------

  const getStatus = (
    task: Task,
    classId: string
  ): ProgressStatus => {
    return (
      getClassProgress(
        task,
        classId
      )?.status ||
      "Pending"
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
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
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
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
          <Clock3 className="h-3.5 w-3.5" />
          In Progress
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <Clock3 className="h-3.5 w-3.5" />
        Pending
      </span>
    )
  }

  // ---------------------------------------------------------------------------
  // Create Task
  // ---------------------------------------------------------------------------

  const handleCreateTask = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    setFormError(null)

    if (!staff) {
      setFormError(
        "Staff information is not available."
      )
      return
    }

    // Only HOD can create tasks
    if (!isHod) {
      setFormError(
        "Only the HOD can create tasks."
      )
      return
    }

    // Validate title
    if (!title.trim()) {
      setFormError(
        "Task name is required."
      )
      return
    }

    // Validate due date
    if (!dueDate) {
      setFormError(
        "Due date is required."
      )
      return
    }

    // Validate years
    if (
      !applyAllYears &&
      selectedYears.length === 0
    ) {
      setFormError(
        'Pick at least one year, or choose "All years".'
      )
      return
    }

    // Validate classes
    if (
      classScope ===
        "specific" &&
      validSelectedClassIds.length ===
        0
    ) {
      setFormError(
        'Pick at least one class, or choose "All classes".'
      )
      return
    }

    // Validate available classes
    if (
      classScope === "all" &&
      availableClasses.length ===
        0
    ) {
      setFormError(
        "No classes are available for this task."
      )
      return
    }

    // -------------------------------------------------------------------------
    // Validate Task Links
    // -------------------------------------------------------------------------

    for (
      let i = 0;
      i < taskLinks.length;
      i++
    ) {
      const link =
        taskLinks[i]

      const hasTitle =
        link.title.trim()
          .length > 0

      const hasUrl =
        link.url.trim()
          .length > 0

      if (
        !hasTitle &&
        !hasUrl
      ) {
        setFormError(
          `Link ${i + 1} is empty. Remove it or fill in both fields.`
        )
        return
      }

      if (
        !hasTitle ||
        !hasUrl
      ) {
        setFormError(
          `Please provide both link name and URL for Link ${i + 1}.`
        )
        return
      }

      if (
        !isValidHttpUrl(
          link.url.trim()
        )
      ) {
        setFormError(
          `Link ${i + 1} must be a valid URL starting with http:// or https://`
        )
        return
      }
    }

    setSubmitting(true)

    try {
      const supabase =
        createClient()

      // -----------------------------------------------------------------------
      // Clean Links
      // -----------------------------------------------------------------------

      const cleanedLinks =
        taskLinks.map(
          (link) => ({
            title:
              link.title.trim(),
            url:
              link.url.trim(),
          })
        )

      // -----------------------------------------------------------------------
      // Insert Task
      // -----------------------------------------------------------------------

      const {
        data: inserted,
        error:
          insertError,
      } = await supabase
        .from("tasks")
        .insert({
          department:
            staff.department,

          title:
            title.trim(),

          description:
            description.trim() ||
            null,

          due_date:
            dueDate,

          target_years:
            applyAllYears
              ? null
              : selectedYears,

          applies_to_all_classes:
            classScope === "all",

          created_by:
            staff.id,

          task_links:
            cleanedLinks,
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      if (!inserted) {
        throw new Error(
          "Task was created but no task record was returned."
        )
      }

      // -----------------------------------------------------------------------
      // Insert Specific Class Links
      // -----------------------------------------------------------------------

      if (
        classScope ===
          "specific" &&
        validSelectedClassIds.length >
          0
      ) {
        const taskClassRows =
          validSelectedClassIds.map(
            (classId) => ({
              task_id:
                inserted.id,
              class_id:
                classId,
            })
          )

        const {
          error:
            linkError,
        } = await supabase
          .from(
            "task_classes"
          )
          .insert(
            taskClassRows
          )

        if (linkError) {
          await supabase
            .from("tasks")
            .delete()
            .eq(
              "id",
              inserted.id
            )

          throw linkError
        }
      }

      // -----------------------------------------------------------------------
      // Reload
      // -----------------------------------------------------------------------

      await loadData(() => false)

      setDialogOpen(false)
      resetForm()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create task. Please try again."
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Task
  // ---------------------------------------------------------------------------

  const handleDeleteTask = async (
    taskId: string
  ) => {
    if (
      !confirm(
        "Delete this task? This can't be undone."
      )
    ) {
      return
    }

    const supabase =
      createClient()

    const {
      error:
        deleteError,
    } = await supabase
      .from("tasks")
      .delete()
      .eq(
        "id",
        taskId
      )

    if (deleteError) {
      alert(
        `Failed to delete task: ${deleteError.message}`
      )
      return
    }

    setTasks(
      (prev) =>
        prev.filter(
          (task) =>
            task.id !==
            taskId
        )
    )
  }

  // ---------------------------------------------------------------------------
  // Scope Label
  // ---------------------------------------------------------------------------

  const scopeLabel = (
    task: Task
  ) => {
    const yearsPart =
      task.target_years &&
      task.target_years.length >
        0
        ? `Year ${task.target_years.join(
            ", "
          )}`
        : "All years"

    if (
      task.applies_to_all_classes
    ) {
      return `${yearsPart} — all classes`
    }

    const classNames = (
      task.task_classes || []
    )
      .map((tc) =>
        tc.classes
          ? classLabel(
              tc.classes
            )
          : null
      )
      .filter(
        (
          name
        ): name is string =>
          Boolean(name)
      )

    return classNames.length >
      0
      ? `${yearsPart} — ${classNames.join(
          ", "
        )}`
      : `${yearsPart} — specific classes`
  }

  // ---------------------------------------------------------------------------
  // Overdue
  // ---------------------------------------------------------------------------

  const isOverdue = (
    task: Task
  ) => {
    if (!task.due_date) {
      return false
    }

    const today =
      new Date()

    today.setHours(
      0,
      0,
      0,
      0
    )

    return (
      new Date(
        task.due_date
      ) < today
    )
  }

  // ---------------------------------------------------------------------------
  // Search + Scope Filter
  //
  // For HOD: every department task matching the search term.
  // For everyone else: same search, PLUS the task must have at least one
  // class visible to them (getVisibleTaskClasses) — a task that doesn't
  // touch any of their assigned classes simply doesn't appear at all.
  // ---------------------------------------------------------------------------

  const filteredTasks =
    tasks.filter(
      (task) => {
        const search =
          searchTerm.toLowerCase()

        const matchesTitle =
          task.title
            .toLowerCase()
            .includes(
              search
            )

        const matchesDescription =
          (
            task.description ||
            ""
          )
            .toLowerCase()
            .includes(
              search
            )

        const matchesLinks =
          task.task_links.some(
            (link) =>
              link.title
                .toLowerCase()
                .includes(
                  search
                ) ||
              link.url
                .toLowerCase()
                .includes(
                  search
                )
          )

        const matchesSearch =
          matchesTitle ||
          matchesDescription ||
          matchesLinks

        if (!matchesSearch) {
          return false
        }

        // HOD: search match is enough, they see every task.
        if (isHod) {
          return true
        }

        // Staff: only keep this task if it actually applies to at least
        // one class they're assigned to.
        return (
          getVisibleTaskClasses(
            task
          ).length > 0
        )
      }
    )

  // ---------------------------------------------------------------------------
  // Open Class
  // ---------------------------------------------------------------------------

  const handleClassClick = (
    task: Task,
    classId: string
  ) => {
    const status =
      getStatus(
        task,
        classId
      )

    // HOD can only open completed work
    if (
      isHod &&
      status !== "Done"
    ) {
      return
    }

    // Staff can only open classes actually assigned to them — the button
    // won't even render for other classes now, but this guards against a
    // stale/forged click just in case.
    if (
      !isHod &&
      !myClassIds.includes(classId)
    ) {
      return
    }

    router.push(
      `task-detail-class/${task.id}/${classId}`
    )
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <DashboardLayout
        userRole={
          staff?.role ||
          "Staff"
        }
        userName={
          staff?.name ||
          "Loading..."
        }
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

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
      <div className="flex flex-col space-y-8 pb-12">

        {/* ----------------------------------------------------------------- */}
        {/* Header */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Tasks
            </h1>

            <p className="text-gray-500 dark:text-gray-400">
              {staff?.department
                ? `Tasks for ${staff.department}`
                : "Department tasks"}
            </p>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* HOD CREATE */}
          {/* --------------------------------------------------------------- */}

          {isHod && (
            <Dialog
              open={
                dialogOpen
              }
              onOpenChange={
                handleDialogOpenChange
              }
            >
              <DialogTrigger
                asChild
              >
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Task
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">

                <DialogHeader>
                  <DialogTitle>
                    Create a new task
                  </DialogTitle>

                  <DialogDescription>
                    Assign a task to your
                    whole department,
                    specific years, or
                    particular classes.
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={
                    handleCreateTask
                  }
                  className="space-y-5"
                >

                  {/* ------------------------------------------------------- */}
                  {/* Task Name */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-2">
                    <Label htmlFor="task-title">
                      Task name
                    </Label>

                    <Input
                      id="task-title"
                      placeholder="e.g. Submit weekly LeetCode report"
                      value={
                        title
                      }
                      onChange={(
                        e
                      ) =>
                        setTitle(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Description */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-2">
                    <Label htmlFor="task-description">
                      Description
                    </Label>

                    <Textarea
                      id="task-description"
                      placeholder="Add any details students or staff need to know..."
                      value={
                        description
                      }
                      onChange={(
                        e
                      ) =>
                        setDescription(
                          e.target.value
                        )
                      }
                      rows={
                        3
                      }
                    />
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Due Date */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-2">
                    <Label htmlFor="task-due-date">
                      Due date
                    </Label>

                    <Input
                      id="task-due-date"
                      type="date"
                      value={
                        dueDate
                      }
                      onChange={(
                        e
                      ) =>
                        setDueDate(
                          e.target.value
                        )
                      }
                      min={
                        new Date()
                          .toISOString()
                          .slice(
                            0,
                            10
                          )
                      }
                    />
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Task Links */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-3">

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>
                          Links
                        </Label>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Add Google Drive,
                          Google Forms,
                          LeetCode or any
                          other useful link.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={
                          addTaskLink
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Link
                      </Button>
                    </div>

                    {taskLinks.length ===
                      0 && (
                      <div className="rounded-md border border-dashed p-4 text-center text-sm text-gray-500">
                        No links added.
                      </div>
                    )}

                    <div className="space-y-3">

                      {taskLinks.map(
                        (
                          link,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                            className="rounded-lg border p-3 dark:border-gray-800"
                          >

                            <div className="mb-3 flex items-center justify-between">

                              <div className="flex items-center gap-2 text-sm font-medium">
                                <LinkIcon className="h-4 w-4 text-blue-500" />

                                Link{" "}
                                {index +
                                  1}
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-gray-400 hover:text-red-500"
                                onClick={() =>
                                  removeTaskLink(
                                    index
                                  )
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="space-y-3">

                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  Link name
                                </Label>

                                <Input
                                  placeholder="e.g. Weekly Assignment"
                                  value={
                                    link.title
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateTaskLink(
                                      index,
                                      "title",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  Link URL
                                </Label>

                                <Input
                                  type="url"
                                  placeholder="https://..."
                                  value={
                                    link.url
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateTaskLink(
                                      index,
                                      "url",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                            </div>
                          </div>
                        )
                      )}

                    </div>
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Year Scope */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-2">

                    <Label>
                      Which years does
                      this apply to?
                    </Label>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-3 dark:border-gray-800">

                      <label className="flex items-center gap-2 text-sm">

                        <Checkbox
                          checked={
                            applyAllYears
                          }
                          onCheckedChange={(
                            checked
                          ) => {
                            const enabled =
                              Boolean(
                                checked
                              )

                            setApplyAllYears(
                              enabled
                            )

                            if (
                              enabled
                            ) {
                              setSelectedYears(
                                []
                              )
                            }
                          }}
                        />

                        All years
                      </label>

                      {!applyAllYears &&
                        years.map(
                          (
                            year
                          ) => (
                            <label
                              key={
                                year
                              }
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedYears.includes(
                                  year
                                )}
                                onCheckedChange={() =>
                                  toggleYear(
                                    year
                                  )
                                }
                              />

                              Year{" "}
                              {
                                year
                              }
                            </label>
                          )
                        )}

                    </div>

                    {!applyAllYears &&
                      years.length ===
                        0 && (
                        <p className="text-xs text-gray-500">
                          No classes found
                          for this
                          department yet.
                        </p>
                      )}
                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Class Scope */}
                  {/* ------------------------------------------------------- */}

                  <div className="space-y-2">

                    <Label>
                      Which classes?
                    </Label>

                    <RadioGroup
                      value={
                        classScope
                      }
                      onValueChange={(
                        value
                      ) =>
                        setClassScope(
                          value as ClassScope
                        )
                      }
                      className="flex flex-col gap-2"
                    >

                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="all" />

                        All classes{" "}
                        {applyAllYears
                          ? "in the department"
                          : "in the selected year(s)"}
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="specific" />

                        Particular classes
                      </label>

                    </RadioGroup>

                    {/* Specific Classes */}

                    {classScope ===
                      "specific" && (
                      <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-3 dark:border-gray-800">

                        {availableClasses.length ===
                          0 && (
                          <p className="text-xs text-gray-500">
                            No classes match
                            the year(s)
                            selected
                            above.
                          </p>
                        )}

                        {availableClasses.map(
                          (
                            c
                          ) => (
                            <label
                              key={
                                c.id
                              }
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={validSelectedClassIds.includes(
                                  c.id
                                )}
                                onCheckedChange={() =>
                                  toggleClass(
                                    c.id
                                  )
                                }
                              />

                              {
                                classLabel(
                                  c
                                )
                              }
                            </label>
                          )
                        )}

                      </div>
                    )}

                  </div>

                  {/* ------------------------------------------------------- */}
                  {/* Form Error */}
                  {/* ------------------------------------------------------- */}

                  {formError && (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">

                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />

                      {formError}
                    </div>
                  )}

                  {/* ------------------------------------------------------- */}
                  {/* Footer */}
                  {/* ------------------------------------------------------- */}

                  <DialogFooter>

                    <Button
                      type="submit"
                      disabled={
                        submitting
                      }
                      className="gap-2"
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}

                      Create Task
                    </Button>

                  </DialogFooter>

                </form>
              </DialogContent>
            </Dialog>
          )}

        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Error */}
        {/* ----------------------------------------------------------------- */}

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <CardContent className="py-4 text-sm text-red-600 dark:text-red-400">
              Failed to load data:{" "}
              {error}
            </CardContent>
          </Card>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Staff Info */}
        {/* ----------------------------------------------------------------- */}

        {!isHod &&
          !error && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
              <CardContent className="py-3 text-sm text-blue-700 dark:text-blue-300">
                {myClassIds.length === 0
                  ? "You're not assigned to any class yet. Ask your HOD to add you in class_staff."
                  : "Tasks assigned by the HOD that apply to your class are shown below."}
              </CardContent>
            </Card>
          )}

        {/* ----------------------------------------------------------------- */}
        {/* Task Section */}
        {/* ----------------------------------------------------------------- */}

        <Card>

          <CardHeader>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <CardTitle>
                  Task Assignments
                </CardTitle>

                <CardDescription>
                  {
                    filteredTasks.length
                  }{" "}
                  of{" "}
                  {
                    tasks.length
                  }{" "}
                  task
                  {tasks.length ===
                  1
                    ? ""
                    : "s"}
                </CardDescription>
              </div>

              {/* Search */}

              <div className="relative w-full md:w-64">

                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />

                <Input
                  type="search"
                  placeholder="Search tasks..."
                  className="h-9 pl-9"
                  value={
                    searchTerm
                  }
                  onChange={(
                    e
                  ) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </CardHeader>

          <CardContent className="space-y-6">

            {/* ------------------------------------------------------------- */}
            {/* Task Cards */}
            {/* ------------------------------------------------------------- */}

            {filteredTasks.map(
              (task) => {

                // Everything below (counts + the class grid) is now built
                // from the VIEWER-SCOPED class list: full task scope for
                // HOD, only-your-classes for everyone else.
                const visibleClasses =
                  getVisibleTaskClasses(
                    task
                  )

                const completedCount =
                  visibleClasses.filter(
                    (
                      classItem
                    ) =>
                      getStatus(
                        task,
                        classItem.id
                      ) ===
                      "Done"
                  ).length

                const inProgressCount =
                  visibleClasses.filter(
                    (
                      classItem
                    ) =>
                      getStatus(
                        task,
                        classItem.id
                      ) ===
                      "In Progress"
                  ).length

                const pendingCount =
                  visibleClasses.filter(
                    (
                      classItem
                    ) =>
                      getStatus(
                        task,
                        classItem.id
                      ) ===
                      "Pending"
                  ).length

                return (
                  <div
                    key={
                      task.id
                    }
                    className="rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-950"
                  >

                    {/* ----------------------------------------------------- */}
                    {/* Task Header */}
                    {/* ----------------------------------------------------- */}

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                      <div className="min-w-0">

                        <div className="flex items-start gap-3">

                          <div className="mt-0.5 rounded-lg bg-blue-100 p-2 dark:bg-blue-950/40">

                            <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />

                          </div>

                          <div className="min-w-0">

                            <h3 className="text-lg font-semibold">
                              {
                                task.title
                              }
                            </h3>

                            {task.description && (
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {
                                  task.description
                                }
                              </p>
                            )}

                          </div>

                        </div>

                      </div>

                      {/* Delete */}

                      {isHod && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="self-end text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 lg:self-auto"
                          onClick={() =>
                            handleDeleteTask(
                              task.id
                            )
                          }
                          aria-label="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}

                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Task Information */}
                    {/* ----------------------------------------------------- */}

                    <div className="mt-5 flex flex-wrap gap-3">

                      {/* Due Date */}

                      <div
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                          isOverdue(
                            task
                          )
                            ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                      >

                        <CalendarDays className="h-3.5 w-3.5" />

                        {task.due_date
                          ? new Date(
                              task.due_date
                            ).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month:
                                  "short",
                                day: "numeric",
                              }
                            )
                          : "No due date"}

                        {isOverdue(
                          task
                        ) && (
                          <span className="font-semibold">
                            Overdue
                          </span>
                        )}

                      </div>

                      {/* Scope */}

                      <div className="rounded-full border px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">
                        {isHod
                          ? scopeLabel(task)
                          : `Your class${
                              visibleClasses.length === 1 ? "" : "es"
                            }: ${
                              visibleClasses.length > 0
                                ? visibleClasses.map((c) => classLabel(c)).join(", ")
                                : "none"
                            }`}
                      </div>

                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Task Links */}
                    {/* ----------------------------------------------------- */}

                    {task.task_links.length >
                      0 && (
                      <div className="mt-5 border-t pt-5 dark:border-gray-800">

                        <div className="mb-3 flex items-center gap-2">

                          <LinkIcon className="h-4 w-4 text-blue-500" />

                          <h4 className="text-sm font-semibold">
                            Resources
                          </h4>

                        </div>

                        <div className="flex flex-col gap-2">

                          {task.task_links.map(
                            (
                              link,
                              index
                            ) => (
                              <a
                                key={
                                  index
                                }
                                href={
                                  link.url
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                              >

                                <div className="flex min-w-0 items-center gap-2">

                                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400" />

                                  <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                                    {
                                      link.title
                                    }
                                  </span>

                                </div>

                                <ExternalLink className="ml-3 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />

                              </a>
                            )
                          )}

                        </div>

                      </div>
                    )}

                    {/* ----------------------------------------------------- */}
                    {/* Progress Summary */}
                    {/* ----------------------------------------------------- */}

                    <div className="mt-5 flex flex-wrap gap-2">

                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                        {
                          completedCount
                        }{" "}
                        Completed
                      </span>

                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        {
                          inProgressCount
                        }{" "}
                        In Progress
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {
                          pendingCount
                        }{" "}
                        Pending
                      </span>

                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Classes */}
                    {/* ----------------------------------------------------- */}

                    <div className="mt-6 border-t pt-5 dark:border-gray-800">

                      <div className="mb-3 flex items-center justify-between">

                        <div>

                          <h4 className="text-sm font-semibold">
                            {isHod ? "Classes" : "Your Class"}
                          </h4>

                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isHod
                              ? "Completed classes can be opened to review the response."
                              : "Select your class to work on this task."}
                          </p>

                        </div>

                        <span className="text-xs text-gray-500">
                          {
                            visibleClasses.length
                          }{" "}
                          class
                          {visibleClasses.length ===
                          1
                            ? ""
                            : "es"}
                        </span>

                      </div>

                      {/* --------------------------------------------------- */}
                      {/* Class Grid */}
                      {/* --------------------------------------------------- */}

                      {visibleClasses.length ===
                        0 ? (
                        <div className="rounded-lg border border-dashed p-5 text-center text-sm text-gray-500">
                          {isHod
                            ? "No classes found for this task."
                            : "This task doesn't apply to your class."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                          {visibleClasses.map(
                            (
                              classItem
                            ) => {

                              const status =
                                getStatus(
                                  task,
                                  classItem.id
                                )

                              const isLocked =
                                isHod &&
                                status !==
                                  "Done"

                              return (
                                <button
                                  key={
                                    classItem.id
                                  }
                                  type="button"
                                  disabled={
                                    isLocked
                                  }
                                  onClick={() =>
                                    handleClassClick(
                                      task,
                                      classItem.id
                                    )
                                  }
                                  className={`group rounded-lg border p-4 text-left transition-all ${
                                    isLocked
                                      ? "cursor-not-allowed bg-gray-50 opacity-75 dark:bg-gray-900"
                                      : "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-700"
                                  }`}
                                >

                                  <div className="flex items-start justify-between gap-3">

                                    <div className="min-w-0">

                                      <p className="truncate text-sm font-semibold">
                                        {
                                          classLabel(
                                            classItem
                                          )
                                        }
                                      </p>

                                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Year{" "}
                                        {
                                          classItem.year
                                        }

                                        {classItem.section
                                          ? ` · Section ${classItem.section}`
                                          : ""}
                                      </p>

                                    </div>

                                    {isLocked ? (
                                      <Lock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                                    )}

                                  </div>

                                  <div className="mt-3">
                                    <StatusBadge
                                      status={
                                        status
                                      }
                                    />
                                  </div>

                                  {isLocked && (
                                    <p className="mt-2 text-[11px] text-gray-400">
                                      Waiting for
                                      staff to
                                      complete
                                      this task
                                    </p>
                                  )}

                                  {!isHod &&
                                    status ===
                                      "Pending" && (
                                      <p className="mt-2 text-[11px] text-gray-400">
                                        Click to
                                        start
                                        working
                                      </p>
                                    )}

                                  {!isHod &&
                                    status ===
                                      "In Progress" && (
                                      <p className="mt-2 text-[11px] text-blue-500">
                                        Continue
                                        working
                                      </p>
                                    )}

                                  {!isHod &&
                                    status ===
                                      "Done" && (
                                      <p className="mt-2 text-[11px] text-green-600 dark:text-green-400">
                                        Completed
                                      </p>
                                    )}

                                </button>
                              )
                            }
                          )}

                        </div>
                      )}

                    </div>

                  </div>
                )
              }
            )}

            {/* ------------------------------------------------------------- */}
            {/* Empty State */}
            {/* ------------------------------------------------------------- */}

            {filteredTasks.length ===
              0 && (
              <div className="rounded-xl border border-dashed py-12 text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">

                  <ClipboardList className="h-6 w-6 text-gray-400" />

                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  {tasks.length ===
                  0
                    ? "No tasks yet"
                    : "No tasks found"}
                </h3>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tasks.length ===
                  0
                    ? isHod
                      ? "Create your first task to get started."
                      : "No tasks have been assigned yet."
                    : isHod
                      ? "Try changing your search term."
                      : "No tasks match your search, or none apply to your class yet."}
                </p>

                {isHod &&
                  tasks.length ===
                    0 && (
                    <Button
                      className="mt-4 gap-2"
                      onClick={() =>
                        setDialogOpen(
                          true
                        )
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Create Task
                    </Button>
                  )}

              </div>
            )}

          </CardContent>

        </Card>

      </div>
    </DashboardLayout>
  )
}