import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal, Flame } from "lucide-react"
import { Student } from "@/types"
import Link from "next/link"

interface StreakLeaderboardProps {
  students: Student[]
}

export function StreakLeaderboard({ students }: StreakLeaderboardProps) {
  // Sort students by streak descending
  const sortedStudents = [...students].sort((a, b) => b.current_streak - a.current_streak)
  
  // Get top 5 or fewer
  const topStudents = sortedStudents.slice(0, 5)

  if (topStudents.length === 0) return null

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 border-amber-200 dark:border-amber-900/50 mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-500">
          <Trophy className="h-5 w-5" />
          Streak Leaderboard
        </CardTitle>
        <CardDescription>Top students ranked by their active learning streaks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topStudents.map((student, index) => (
            <Link 
              key={student.id} 
              href={`/dashboard/student/${student.id}`}
              className="flex items-center justify-between p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-700/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm">
                  {index === 0 ? <Medal className="text-yellow-500 h-6 w-6" /> : 
                   index === 1 ? <Medal className="text-gray-400 h-5 w-5" /> :
                   index === 2 ? <Medal className="text-amber-700 h-5 w-5" /> :
                   <span className="text-gray-500">#{index + 1}</span>}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.register_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-full">
                <Flame className="h-4 w-4" />
                <span>{student.current_streak} days</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
