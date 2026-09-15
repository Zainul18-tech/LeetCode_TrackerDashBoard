export type Role = "HOD" | "Teacher" | "Tutor" | "Class Advisor" | "Dean" | "Staff";
export type Status = "Active" | "Inactive";

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  year?: string;
  section?: string;
}

export interface Class {
  id: string;
  name: string;
  year: string;
  department: string;
  section?: string;
  tutor_id: string;
  advisor_id: string;
}

export interface Student {
  id: string;
  register_number: string;
  reg_no?: string;
  name: string;
  class_id: string;
  leetcode_username: string;
  github_username: string;
  github_link?: string;
  current_streak: number;
  status: Status;
  department?: string;
  year?: string | number;
  section?: string;
}

export interface StudentSummary {
  student_id: string;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  active_days: number;
  last_active: string;
}

export interface WeeklyRecord {
  id: string;
  class_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
}

export interface WeeklyStudentProgress {
  record_id: string;
  student_id: string;
  assignment_completed: boolean;
  assignment_count: number;
  weekly_contest: boolean;
  weekly_contest_score: number;
  biweekly_contest: boolean;
  biweekly_contest_score: number;
  aptitude: boolean;
  aptitude_marks: number;
  verbal: boolean;
  verbal_marks: number;
  remarks: string;
  status: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  status: "Success" | "Failed";
  details: string;
}

export interface ClassDashboardCard {
  id: string;
  name: string;
  year: string;
  department?: string;
  total_students: number;
  tutor_name: string;
  advisor_name: string;
  average_streak: number;
  weekly_completion: number; // percentage
  active_students: number;
  assignment_completion: number; // percentage
}
