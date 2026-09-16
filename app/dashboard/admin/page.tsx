"use client"

import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OverviewBarChart, DifficultyPieChart } from "@/components/ui/charts"
import { MOCK_CLASSES, MOCK_CHART_DATA, MOCK_STUDENTS } from "@/lib/mock-data"
import { Users, GraduationCap, Trophy, ArrowRight, Activity, Target } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function HODDashboard() {
  const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"]
  const topStudents = [...MOCK_STUDENTS].sort((a, b) => b.current_streak - a.current_streak).slice(0, 5)

  const kpis = [
    { title: "Total Students", value: "714", icon: Users, desc: "+12 from last week" },
    { title: "Total Classes", value: "12", icon: GraduationCap, desc: "Across 4 years" },
    { title: "Active Today", value: "582", icon: Activity, desc: "81.5% engagement" },
    { title: "Avg Streak", value: "18.4", icon: Target, desc: "Days" },
  ]

  return (
    <DashboardLayout userRole="HOD" userName="Dr. Alan Turing">
      <div className="flex flex-col space-y-8 pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Computer Science Engineering Department Overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <kpi.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Analytics Charts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-2 lg:row-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Weekly Solving Progress</CardTitle>
              <CardDescription>Problems solved across the department in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <OverviewBarChart data={MOCK_CHART_DATA.weeklyProgress} />
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>Total problems solved by difficulty</CardDescription>
            </CardHeader>
            <CardContent>
              <DifficultyPieChart data={MOCK_CHART_DATA.difficultyDistribution} />
              <div className="mt-4 flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500"></span> Easy</div>
                <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-500"></span> Medium</div>
                <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500"></span> Hard</div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Top Students</CardTitle>
              <CardDescription>Ranked by current streak</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topStudents.map((student, idx) => (
                  <div key={student.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs dark:bg-blue-900 dark:text-blue-300">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium leading-none truncate text-gray-900 dark:text-gray-100">{student.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.register_number}</p>
                    </div>
                    <div className="flex items-center gap-1 font-medium text-orange-500">
                      <Trophy className="h-3 w-3" />
                      <span>{student.current_streak}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Classes Section */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-6">Classes Overview</h2>
          
          <div className="space-y-8">
            {years.map((year, yearIdx) => {
              const yearClasses = MOCK_CLASSES.filter(c => c.year === year)
              if (yearClasses.length === 0) return null
              
              return (
                <div key={year}>
                  <h3 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-2 dark:border-gray-800">{year}</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {yearClasses.map((cls, idx) => (
                      <motion.div
                        key={cls.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (yearIdx * 0.1) + (idx * 0.05) }}
                        whileHover={{ y: -5, scale: 1.02 }}
                        className="h-full"
                      >
                        <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 border-gray-200 dark:border-gray-800">
                          <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-xl text-blue-600 dark:text-blue-400">{cls.name}</CardTitle>
                                <CardDescription>{cls.total_students} Students</CardDescription>
                              </div>
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                                {Math.round(cls.weekly_completion)}%
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Tutor:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100 truncate pl-2">{cls.tutor_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Advisor:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100 truncate pl-2">{cls.advisor_name}</span>
                              </div>
                              <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                <span className="text-gray-500">Avg Streak:</span>
                                <span className="font-medium">{cls.average_streak} days</span>
                              </div>
                            </div>
                          </CardContent>
                          <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
                            <Link 
                              href={`/dashboard/class/${cls.id}`}
                              className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-50 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800"
                            >
                              View Dashboard
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}