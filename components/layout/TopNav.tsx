"use client"

import { Bell, Menu, Sun, Moon } from "lucide-react"
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

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4">
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