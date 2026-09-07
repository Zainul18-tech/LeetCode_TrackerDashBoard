"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChevronDown, ChevronRight, School } from "lucide-react"
import { cn } from "@/lib/utils"
import { Class } from "@/types"

interface ClassesPanelProps {
  classes: Class[]
  selectedClassId: string | null
  onSelectClass: (classId: string) => void
  isHOD: boolean
}

export default function ClassesPanel({
  classes,
  selectedClassId,
  onSelectClass,
  isHOD,
}: ClassesPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <School className="h-5 w-5" />
          Classes
        </CardTitle>
        <CardDescription>
          {isHOD
            ? "All sections in your department. Click a class to view its students below."
            : "Classes assigned to you. Click a class to view its students below."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No classes found.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => {
              const isActive = selectedClassId === cls.id
              return (
                <button
                  key={cls.id}
                  onClick={() => onSelectClass(cls.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                    isActive
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {cls.name || `${cls.department} Y${cls.year} ${cls.section}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {cls.department} • Year {cls.year} • Section {cls.section}
                    </p>
                  </div>
                  {isActive ? (
                    <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}