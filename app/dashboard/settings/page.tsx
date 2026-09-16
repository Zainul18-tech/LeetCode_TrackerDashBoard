"use client"

import { useState } from "react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserCircle, Mail, Key, Save, CheckCircle2, Loader2 } from "lucide-react"

export default function SettingsDashboard() {
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const [name, setName] = useState("Dr. Alan Turing")
  const [email, setEmail] = useState("alan.turing@college.edu")
  const [weeklyReports, setWeeklyReports] = useState(true)
  const [systemAlerts, setSystemAlerts] = useState(true)

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  return (
    <DashboardLayout userRole="HOD" userName={name}>
      <div className="flex flex-col space-y-6 pb-12 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your account settings and preferences.</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className={saveSuccess ? "bg-green-600 hover:bg-green-700 text-white" : ""}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
             saveSuccess ? <CheckCircle2 className="mr-2 h-4 w-4" /> : 
             <Save className="mr-2 h-4 w-4" />}
            {saveSuccess ? "Saved!" : "Save Changes"}
          </Button>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details and role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    {name.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase()}
                  </div>
                  <Button variant="outline">Change Avatar</Button>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <div className="relative">
                      <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <Input defaultValue="Computer Science Engineering" disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Input defaultValue="Head of Department" disabled />
                  </div>
                </div>
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
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer" onClick={() => setWeeklyReports(!weeklyReports)}>
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium cursor-pointer">Weekly Reports</label>
                    <p className="text-sm text-gray-500">Receive an email summary of the departments LeetCode progress.</p>
                  </div>
                  <input type="checkbox" checked={weeklyReports} onChange={(e) => setWeeklyReports(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer" onClick={() => setSystemAlerts(!systemAlerts)}>
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium cursor-pointer">System Alerts</label>
                    <p className="text-sm text-gray-500">Get notified about sync failures or system maintenance.</p>
                  </div>
                  <input type="checkbox" checked={systemAlerts} onChange={(e) => setSystemAlerts(e.target.checked)} className="h-4 w-4 cursor-pointer" />
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
                <Button variant="outline">
                  <Key className="mr-2 h-4 w-4" /> Change Password
                </Button>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h4>
                  <Button variant="destructive">Delete Account Data</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
