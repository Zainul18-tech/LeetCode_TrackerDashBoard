import { ClassDashboardCard, Student, StudentSummary, WeeklyStudentProgress } from "@/types";

export const MOCK_CLASSES: ClassDashboardCard[] = [
  { id: "c1", name: "CSE-A", year: "1st Year", total_students: 60, tutor_name: "Alice Johnson", advisor_name: "Bob Smith", average_streak: 12, weekly_completion: 85, active_students: 55, assignment_completion: 90 },
  { id: "c2", name: "CSE-B", year: "1st Year", total_students: 62, tutor_name: "Charlie Brown", advisor_name: "Diana Prince", average_streak: 8, weekly_completion: 70, active_students: 40, assignment_completion: 75 },
  { id: "c3", name: "CSE-C", year: "1st Year", total_students: 58, tutor_name: "Eve Adams", advisor_name: "Frank Castle", average_streak: 15, weekly_completion: 92, active_students: 56, assignment_completion: 95 },
  { id: "c4", name: "CSE-D", year: "1st Year", total_students: 61, tutor_name: "Grace Lee", advisor_name: "Hank Pym", average_streak: 5, weekly_completion: 60, active_students: 35, assignment_completion: 65 },
  
  { id: "c5", name: "CSE-A", year: "2nd Year", total_students: 55, tutor_name: "Ivy Chen", advisor_name: "Jack Ryan", average_streak: 20, weekly_completion: 88, active_students: 50, assignment_completion: 85 },
  { id: "c6", name: "CSE-B", year: "2nd Year", total_students: 57, tutor_name: "Karen Page", advisor_name: "Leo Fitz", average_streak: 18, weekly_completion: 82, active_students: 48, assignment_completion: 80 },
  { id: "c7", name: "CSE-C", year: "2nd Year", total_students: 56, tutor_name: "Mia Toretto", advisor_name: "Nick Fury", average_streak: 10, weekly_completion: 75, active_students: 42, assignment_completion: 70 },
  
  { id: "c8", name: "CSE-A", year: "3rd Year", total_students: 65, tutor_name: "Olivia Pope", advisor_name: "Peter Parker", average_streak: 25, weekly_completion: 95, active_students: 60, assignment_completion: 98 },
  { id: "c9", name: "CSE-B", year: "3rd Year", total_students: 63, tutor_name: "Quinn Fabray", advisor_name: "Rachel Green", average_streak: 22, weekly_completion: 90, active_students: 58, assignment_completion: 92 },
  { id: "c10", name: "CSE-C", year: "3rd Year", total_students: 60, tutor_name: "Steve Rogers", advisor_name: "Tony Stark", average_streak: 30, weekly_completion: 98, active_students: 59, assignment_completion: 100 },
  
  { id: "c11", name: "CSE-A", year: "4th Year", total_students: 50, tutor_name: "Ursula Buffay", advisor_name: "Victor Stone", average_streak: 35, weekly_completion: 99, active_students: 48, assignment_completion: 100 },
  { id: "c12", name: "CSE-B", year: "4th Year", total_students: 52, tutor_name: "Wanda Maximoff", advisor_name: "Xavier Charles", average_streak: 28, weekly_completion: 94, active_students: 45, assignment_completion: 95 },
];

export const MOCK_STUDENTS: Student[] = [
  { id: "s1", register_number: "21CS001", name: "John Doe", class_id: "c8", leetcode_username: "johndoe", github_username: "johndoe_dev", current_streak: 45, status: "Active" },
  { id: "s2", register_number: "21CS002", name: "Jane Smith", class_id: "c8", leetcode_username: "janesmith", github_username: "jane_s", current_streak: 12, status: "Active" },
  { id: "s3", register_number: "21CS003", name: "Mike Johnson", class_id: "c8", leetcode_username: "mikej", github_username: "mike_j", current_streak: 2, status: "Inactive" },
  { id: "s4", register_number: "21CS004", name: "Sarah Williams", class_id: "c8", leetcode_username: "sarahw", github_username: "swilliams", current_streak: 120, status: "Active" },
  { id: "s5", register_number: "21CS005", name: "David Brown", class_id: "c8", leetcode_username: "davidb", github_username: "dbrown", current_streak: 0, status: "Inactive" },
];

export const MOCK_STUDENT_SUMMARIES: Record<string, StudentSummary> = {
  "s1": { student_id: "s1", total_solved: 350, easy_solved: 150, medium_solved: 150, hard_solved: 50, active_days: 200, last_active: "2024-03-15" },
  "s2": { student_id: "s2", total_solved: 120, easy_solved: 80, medium_solved: 35, hard_solved: 5, active_days: 45, last_active: "2024-03-14" },
  "s3": { student_id: "s3", total_solved: 45, easy_solved: 40, medium_solved: 5, hard_solved: 0, active_days: 12, last_active: "2024-03-01" },
  "s4": { student_id: "s4", total_solved: 850, easy_solved: 300, medium_solved: 400, hard_solved: 150, active_days: 360, last_active: "2024-03-15" },
  "s5": { student_id: "s5", total_solved: 10, easy_solved: 10, medium_solved: 0, hard_solved: 0, active_days: 3, last_active: "2023-12-01" },
};

export const MOCK_WEEKLY_PROGRESS: WeeklyStudentProgress[] = [
  { record_id: "r1", student_id: "s1", assignment_completed: true, assignment_count: 5, weekly_contest: true, weekly_contest_score: 12, biweekly_contest: false, biweekly_contest_score: 0, aptitude: true, aptitude_marks: 85, verbal: true, verbal_marks: 90, remarks: "Excellent performance", status: "Completed" },
  { record_id: "r1", student_id: "s2", assignment_completed: true, assignment_count: 5, weekly_contest: false, weekly_contest_score: 0, biweekly_contest: false, biweekly_contest_score: 0, aptitude: true, aptitude_marks: 70, verbal: true, verbal_marks: 75, remarks: "Needs to participate in contests", status: "Completed" },
  { record_id: "r1", student_id: "s3", assignment_completed: false, assignment_count: 2, weekly_contest: false, weekly_contest_score: 0, biweekly_contest: false, biweekly_contest_score: 0, aptitude: false, aptitude_marks: 0, verbal: false, verbal_marks: 0, remarks: "Inactive this week", status: "Pending" },
];

export const MOCK_CHART_DATA = {
  weeklyProgress: [
    { name: 'Mon', solved: 45, expected: 50 },
    { name: 'Tue', solved: 52, expected: 50 },
    { name: 'Wed', solved: 38, expected: 50 },
    { name: 'Thu', solved: 65, expected: 50 },
    { name: 'Fri', solved: 48, expected: 50 },
    { name: 'Sat', solved: 85, expected: 60 },
    { name: 'Sun', solved: 92, expected: 60 },
  ],
  difficultyDistribution: [
    { name: 'Easy', value: 400, fill: '#22c55e' },
    { name: 'Medium', value: 300, fill: '#eab308' },
    { name: 'Hard', value: 100, fill: '#ef4444' },
  ]
};
