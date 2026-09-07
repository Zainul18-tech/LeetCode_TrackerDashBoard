import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

// Install with: npm install jspdf jspdf-autotable xlsx

export type ExportableStudent = {
  reg_no: string
  name: string
  department?: string
  year?: number | string
  section?: string
  leetcode_username?: string | null
  github_link?: string | null
  easy_count?: number | null
  medium_count?: number | null
  hard_count?: number | null
  current_streak?: number | null
}

const EXPORT_HEADERS = ["Reg No", "Name", "Dept/Year/Sec", "LeetCode", "Easy", "Medium", "Hard", "Streak"]

function toRow(s: ExportableStudent) {
  return [
    s.reg_no,
    s.name,
    `${s.department ?? ""} Y${s.year ?? ""} ${s.section ?? ""}`.trim(),
    s.leetcode_username || "-",
    s.easy_count ?? 0,
    s.medium_count ?? 0,
    s.hard_count ?? 0,
    s.current_streak ?? 0,
  ]
}

export function exportStudentsToPDF(
  students: ExportableStudent[],
  title: string,
  fileName = "class-report"
) {
  const doc = new jsPDF()

  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 22)

  autoTable(doc, {
    startY: 28,
    head: [EXPORT_HEADERS],
    body: students.map(toRow),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  doc.save(`${fileName}.pdf`)
}

export function exportStudentsToExcel(students: ExportableStudent[], fileName = "class-report") {
  const rows = students.map((s) => ({
    "Reg No": s.reg_no,
    Name: s.name,
    "Dept/Year/Section": `${s.department ?? ""} Y${s.year ?? ""} ${s.section ?? ""}`.trim(),
    LeetCode: s.leetcode_username || "-",
    Easy: s.easy_count ?? 0,
    Medium: s.medium_count ?? 0,
    Hard: s.hard_count ?? 0,
    Streak: s.current_streak ?? 0,
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students")
  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}