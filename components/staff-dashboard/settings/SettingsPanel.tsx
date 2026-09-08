"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  UserCircle,
  Mail,
  Key,
  Save,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Lock,
  ClipboardList,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Matches public.staff exactly
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

// Embedded class info from public.classes, via the class_staff.class_id FK
type ClassInfo = {
  id: string
  class_name: string | null
  department: string
  year: number
  section: string
  batch: string | null
}

// Matches public.class_staff, with the related class embedded
type ClassStaffRow = {
  id: string
  role: "Tutor" | "Class Advisor"
  status: string | null
  status_updated_at: string | null
  classes: ClassInfo | null
}

const statusStyles: Record<string, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "On Leave": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Busy: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Unavailable: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
}
// Fallback style for any free-text status that isn't one of the above
const defaultStatusStyle = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"

type SettingsPanelProps = {
  // Optional: lets a parent (e.g. the dashboard header) stay in sync after
  // a successful save. Not required — the panel is fully self-contained.
  onStaffUpdate?: (staff: Staff) => void
}

export default function SettingsPanel({ onStaffUpdate }: SettingsPanelProps) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [name, setName] = useState("")
  // Email is frozen/read-only (see Profile tab) — no setter is wired to
  // its input on purpose. It's still tracked in state purely for display.
  const [email, setEmail] = useState("")
  const [weeklyReports, setWeeklyReports] = useState(true)
  const [systemAlerts, setSystemAlerts] = useState(true)

  // --- Class assignments / status state ---
  const [assignments, setAssignments] = useState<ClassStaffRow[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null)
  const [rowSavedId, setRowSavedId] = useState<string | null>(null)
  // What the person has typed for each row's status, keyed by class_staff.id.
  // Kept separate from `assignments` so typing doesn't require a round trip.
  const [statusInputs, setStatusInputs] = useState<Record<string, string>>({})

  // --- Change password state ---
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadStaff() {
      setLoading(true)
      setLoadError(null)
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !user) {
        setLoadError("You are not logged in. Please sign in again.")
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
        setLoadError(staffError.message)
        setLoading(false)
        return
      }

      if (!staffRow) {
        setLoadError(
          "No staff profile is linked to this login. Ask your HOD/admin to set staff.user_id for your account."
        )
        setLoading(false)
        return
      }

      setStaff(staffRow)
      setName(staffRow.name)
      setEmail(staffRow.email)
      setLoading(false)

      // Class assignments only exist for Tutor / Class Advisor rows
      // (class_staff.role check constraint) — HOD/Teacher just won't have
      // any rows, and the tab shows an empty state for them.
      setAssignmentsLoading(true)
      const { data: assignmentRows, error: assignmentsFetchError } = await supabase
        .from("class_staff")
        .select("id, role, status, status_updated_at, classes(id, class_name, department, year, section, batch)")
        .eq("staff_id", staffRow.id)
        .order("created_at", { ascending: true })

      if (!isMounted) return

      if (assignmentsFetchError) {
        setAssignmentsError(assignmentsFetchError.message)
      } else {
        const rows = (assignmentRows as unknown as ClassStaffRow[] | null) || []
        setAssignments(rows)
        setStatusInputs(Object.fromEntries(rows.map((r) => [r.id, r.status ?? ""])))
      }
      setAssignmentsLoading(false)
    }

    loadStaff()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSave = async () => {
    if (!staff) return

    setIsSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    const supabase = createClient()
    // Email is frozen — only `name` is ever sent to the update.
    const { data: updatedRow, error } = await supabase
      .from("staff")
      .update({ name })
      .eq("id", staff.id)
      .select("*")
      .maybeSingle()

    setIsSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    const nextStaff = updatedRow || { ...staff, name }
    setStaff(nextStaff)
    onStaffUpdate?.(nextStaff)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleSaveStatus = async (rowId: string) => {
    const currentRow = assignments.find((row) => row.id === rowId)
    const typedValue = (statusInputs[rowId] ?? "").trim()

    // Nothing to save if it matches what's already stored (including both
    // being empty).
    if (typedValue === (currentRow?.status ?? "")) return

    setUpdatingRowId(rowId)
    setAssignmentsError(null)

    const supabase = createClient()
    const nowIso = new Date().toISOString()
    const { data: updatedRow, error } = await supabase
      .from("class_staff")
      .update({ status: typedValue || null, status_updated_at: nowIso })
      .eq("id", rowId)
      .select("id, status, status_updated_at")
      .maybeSingle()

    setUpdatingRowId(null)

    if (error) {
      setAssignmentsError(error.message)
      return
    }

    const savedStatus = updatedRow?.status ?? (typedValue || null)
    const savedAt = updatedRow?.status_updated_at ?? nowIso

    setAssignments((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, status: savedStatus, status_updated_at: savedAt } : row))
    )
    setStatusInputs((prev) => ({ ...prev, [rowId]: savedStatus ?? "" }))
    setRowSavedId(rowId)
    setTimeout(() => setRowSavedId((current) => (current === rowId ? null : current)), 2000)
  }

  const resetPasswordForm = () => {
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError(null)
  }

  const handleTogglePasswordForm = () => {
    setShowPasswordForm((v) => !v)
    setPasswordSuccess(false)
    resetPasswordForm()
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    setIsChangingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsChangingPassword(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setPasswordSuccess(true)
    resetPasswordForm()
    setTimeout(() => {
      setPasswordSuccess(false)
      setShowPasswordForm(false)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (loadError || !staff) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {loadError || "Could not load your staff profile."}
        </p>
      </div>
    )
  }

  const classLabel = (c: ClassInfo | null) =>
    c ? c.class_name || `Year ${c.year} - Section ${c.section}` : "Unknown class"

  return (
    <div className="flex w-full flex-col space-y-6 overflow-x-hidden">
      {/* Header: stacks on mobile so the Save button never gets squeezed
          against the title/subtitle on a narrow screen. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your account settings and preferences.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full sm:w-auto ${saveSuccess ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveSuccess ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {saveError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="py-3 text-sm text-red-600 dark:text-red-400">
            Failed to save: {saveError}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profile" className="w-full">
        {/* 5 tabs won't fit on a phone width — let the row scroll
            horizontally instead of overflowing the page or wrapping into
            a squashed grid. -mx-4 px-4 lets the scroll area bleed to the
            dialog/card edges so the last tab isn't clipped. */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <TabsList className="w-max sm:w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details and role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                  {name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <Button variant="outline">Change Avatar</Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Email Address{" "}
                    <span className="font-normal text-gray-400 dark:text-gray-500">(cannot be changed)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      value={email}
                      readOnly
                      disabled
                      className="pl-9 cursor-not-allowed opacity-70"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Department</label>
                  <Input defaultValue={staff.department} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Input defaultValue={staff.role} disabled />
                </div>
                {(staff.year !== null || staff.section !== null) && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Year</label>
                      <Input defaultValue={staff.year != null ? String(staff.year) : "—"} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Section</label>
                      <Input defaultValue={staff.section ?? "—"} disabled />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class Assignments</CardTitle>
              <CardDescription>
                Type a status for each class you are assigned to as Tutor or Class Advisor, then press
                Enter or Save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignmentsError && (
                <p className="text-sm text-red-600 dark:text-red-400">{assignmentsError}</p>
              )}

              {assignmentsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <ClipboardList className="h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                    No class assignments yet. Ask your HOD/admin to assign you as
                    a Tutor or Class Advisor for a class.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                            {classLabel(row.classes)}
                          </p>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {row.role}
                          </span>
                          {/* Status pill now shows on mobile too, next to
                              the role badge, instead of being hidden. */}
                          {row.status && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                statusStyles[row.status] || defaultStatusStyle
                              }`}
                            >
                              {row.status}
                            </span>
                          )}
                        </div>
                        {row.classes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {row.classes.department} · Year {row.classes.year} · Section{" "}
                            {row.classes.section}
                            {row.classes.batch ? ` · Batch ${row.classes.batch}` : ""}
                          </p>
                        )}
                        {row.status_updated_at && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Updated {new Date(row.status_updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Controls wrap onto their own line and the input
                          grows to fill available width on mobile, instead
                          of a fixed w-40 that could force horizontal
                          overflow next to the save button. */}
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                        {rowSavedId === row.id && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                        )}
                        <Input
                          value={statusInputs[row.id] ?? ""}
                          onChange={(e) =>
                            setStatusInputs((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleSaveStatus(row.id)
                            }
                          }}
                          placeholder="Type a status..."
                          className="h-9 min-w-0 flex-1 sm:w-40 sm:flex-none"
                          disabled={updatingRowId === row.id}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => handleSaveStatus(row.id)}
                          disabled={
                            updatingRowId === row.id ||
                            (statusInputs[row.id] ?? "").trim() === (row.status ?? "")
                          }
                        >
                          {updatingRowId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Preferences</CardTitle>
              <CardDescription>Manage your app experience and data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-500">
              <p>Theme settings are handled directly in the top navigation bar.</p>
              <p>Data export features are available on individual class dashboards.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50 cursor-pointer sm:items-center sm:justify-between dark:hover:bg-gray-900/50"
                onClick={() => setWeeklyReports(!weeklyReports)}
              >
                <div className="space-y-0.5">
                  <label className="text-sm font-medium cursor-pointer">Weekly Reports</label>
                  <p className="text-sm text-gray-500">
                    Receive an email summary of the department&apos;s LeetCode progress.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={weeklyReports}
                  onChange={(e) => setWeeklyReports(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer sm:mt-0"
                />
              </div>
              <div
                className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50 cursor-pointer sm:items-center sm:justify-between dark:hover:bg-gray-900/50"
                onClick={() => setSystemAlerts(!systemAlerts)}
              >
                <div className="space-y-0.5">
                  <label className="text-sm font-medium cursor-pointer">System Alerts</label>
                  <p className="text-sm text-gray-500">
                    Get notified about sync failures or system maintenance.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemAlerts}
                  onChange={(e) => setSystemAlerts(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer sm:mt-0"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your password and security options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showPasswordForm ? (
                <Button variant="outline" className="w-full sm:w-auto" onClick={handleTogglePasswordForm}>
                  <Key className="mr-2 h-4 w-4" /> Change Password
                </Button>
              ) : (
                <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" /> Password updated successfully.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                      className="w-full sm:w-auto"
                    >
                      {isChangingPassword ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Key className="mr-2 h-4 w-4" />
                      )}
                      Update Password
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleTogglePasswordForm}
                      disabled={isChangingPassword}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}