import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LeetCode Portal",
  description: "Student progress tracking dashboard",
}

// Runs synchronously in <head>, before React hydrates or paints anything.
// This is what actually prevents the light-mode flash on load/refresh.
const themeInitScript = `
  (function () {
    try {
      var stored = localStorage.getItem("theme");
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var shouldBeDark = stored ? stored === "dark" : prefersDark;
      if (shouldBeDark) {
        document.documentElement.classList.add("dark");
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}