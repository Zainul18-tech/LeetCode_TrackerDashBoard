"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { OverviewBarChart, DifficultyPieChart } from "@/components/ui/charts"
import { MOCK_CHART_DATA } from "@/lib/mock-data"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Download, Search, CheckCircle2, ArrowUpRight, Save, UserCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Class, Student, WeeklyRecord, WeeklyStudentProgress } from "@/types"

export default function ClassDashboard() {
  const params = useParams()
  const searchParams = useSearchParams()
  const classId = params?.id as string || "c8"
  const defaultTab = searchParams.get('tab') || "overview"
  
  const [classData, setClassData] = useState<Class | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<WeeklyRecord[]>([])
  const [progress, setProgress] = useState<WeeklyStudentProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      const { data: classResult } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single()
        
      if (classResult) {
        setClassData(classResult)
      }
      
      const { data: studentsResult } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        
      if (studentsResult) {
        setStudents(studentsResult)
      }
      
      const { data: recordsResult } = await supabase
        .from('weekly_records')
        .select('*')
        .eq('class_id', classId)
        .order('week_number', { ascending: false })
        
      if (recordsResult) {
        setRecords(recordsResult)
        
        if (recordsResult.length > 0) {
          const { data: progressResult } = await supabase
            .from('weekly_student_progress')
            .select('*')
            .eq('record_id', recordsResult[0].id)
            
          if (progressResult) {
            setProgress(progressResult)
          }
        }
      }
      
      setLoading(false)
    }
    
    loadData()
  }, [classId])

  if (loading) {
    return (
      <DashboardLayout userRole="HOD" userName="Dr. Alan Turing">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!classData) {
    return (
      <DashboardLayout userRole="HOD" userName="Dr. Alan Turing">
        <div className="flex h-96 items-center justify-center flex-col gap-4">
          <h2 className="text-xl font-semibold">Class not found</h2>
          <p className="text-gray-500">The requested class dashboard does not exist in the database.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userRole="HOD" userName="Dr. Alan Turing">
      <div className="flex flex-col space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">{classData.year}</Badge>
              <Badge variant="outline">Dept: {classData.department || "CSE"}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{classData.name} Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Tutor ID: {classData.tutor_id} • Advisor ID: {classData.advisor_id}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="records">Weekly Records</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Class Strength</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{students.length}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{students.filter(s => s.status === 'Active').length} Active Today</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Average Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{students.length > 0 ? Math.round(students.reduce((acc, s) => acc + s.current_streak, 0) / students.length) : 0}</div>
                  <p className="text-xs text-green-600 dark:text-green-400">Current Average</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Weekly Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{progress.length > 0 ? Math.round((progress.filter(p => p.assignment_completed).length / progress.length) * 100) : 0}%</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Assignments submitted</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold truncate">{students.length > 0 ? [...students].sort((a,b) => b.current_streak - a.current_streak)[0].name : "N/A"}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">120 day streak</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Problem Solving</CardTitle>
                </CardHeader>
                <CardContent>
                  <OverviewBarChart data={MOCK_CHART_DATA.weeklyProgress} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Difficulty Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <DifficultyPieChart data={MOCK_CHART_DATA.difficultyDistribution} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="students">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Student Directory</CardTitle>
                  <CardDescription>All students in {classData.name}</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input placeholder="Search students..." className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Register No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Streak</TableHead>
                      <TableHead>LeetCode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.register_number}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.current_streak} days</TableCell>
                        <TableCell>
                          <a href={`https://leetcode.com/u/${student.leetcode_username}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {student.leetcode_username}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.status === "Active" ? "success" : "secondary"}>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/student/${student.id}`}>
                            <Button variant="ghost" size="sm">
                              Profile <ArrowUpRight className="ml-1 h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="records">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Weekly Records (Week 4)</CardTitle>
                  <CardDescription>Editable student progress records</CardDescription>
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Student</TableHead>
                      <TableHead>Assignment (Count)</TableHead>
                      <TableHead>W Contest (Score)</TableHead>
                      <TableHead>BW Contest (Score)</TableHead>
                      <TableHead>Aptitude (Marks)</TableHead>
                      <TableHead>Verbal (Marks)</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
                            <Input type="number" defaultValue="5" className="h-8 w-16 px-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
                            <Input type="number" defaultValue="12" className="h-8 w-16 px-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                            <Input type="number" defaultValue="0" className="h-8 w-16 px-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
                            <Input type="number" defaultValue="85" className="h-8 w-16 px-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
                            <Input type="number" defaultValue="90" className="h-8 w-16 px-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input defaultValue="Excellent performance" className="h-8 min-w-[150px]" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analytics</CardTitle>
                <CardDescription>Advanced metrics for {classData.name}</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center text-gray-500">
                Analytics Module Loading...
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Class Leaderboard</CardTitle>
                <CardDescription>Top performers in {classData.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {students.sort((a,b) => b.current_streak - a.current_streak).map((student, index) => (
                    <Link href={`/dashboard/student/${student.id}`} key={student.id} className="block">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${index < 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            #{index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-8 w-8 text-gray-400" />
                            <div>
                              <p className="font-medium leading-none">{student.name}</p>
                              <p className="text-sm text-gray-500 mt-1">{student.register_number}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600 dark:text-blue-400">{student.current_streak} days</p>
                          <p className="text-xs text-gray-500">Current Streak</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
