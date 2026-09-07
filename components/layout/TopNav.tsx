"use client"

import { Bell, Menu, Search, Sun, Moon, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

interface TopNavProps {
  onMenuClick: () => void
  userRole: string
  userName: string
}

const THEME_STORAGE_KEY = "theme"

export default function TopNav({ onMenuClick, userRole, userName }: TopNavProps) {
  const [isDark, setIsDark] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // On mount: prefer whatever the user explicitly chose before (localStorage).
  // Only fall back to OS preference if they've never toggled it themselves.
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const shouldBeDark = stored ? stored === "dark" : prefersDark

    document.documentElement.classList.toggle("dark", shouldBeDark)
    setIsDark(shouldBeDark)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light")
    setIsDark(next)
  }

  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    setSyncStatus('idle')
    
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      if (response.ok) {
        setSyncStatus('success')
        setTimeout(() => setSyncStatus('idle'), 3000)
      } else {
        setSyncStatus('error')
        setTimeout(() => setSyncStatus('idle'), 3000)
      }
    } catch (error) {
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSync}
          disabled={isSyncing}
          className={`hidden sm:flex transition-all ${syncStatus === 'success' ? 'border-green-500 text-green-600 dark:text-green-500' : syncStatus === 'error' ? 'border-red-500 text-red-600 dark:text-red-500' : ''}`}
        >
          {syncStatus === 'success' ? (
            <><CheckCircle2 className="mr-2 h-4 w-4" /> Synced</>
          ) : syncStatus === 'error' ? (
            <><AlertCircle className="mr-2 h-4 w-4" /> Failed</>
          ) : (
            <><RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> {isSyncing ? 'Syncing...' : 'Sync Data'}</>
          )}
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-red-600"></span>
        </Button>
        
        <div className="flex items-center gap-2 border-l border-gray-200 pl-4 dark:border-gray-800">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none text-gray-900 dark:text-gray-50">{userName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{userRole}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
            {userName.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  )
}