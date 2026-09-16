export type StaffRole = "HOD" | "Teacher" | "Tutor" | "Class Advisor" | "Dean";

export const STAFF_ROLES: StaffRole[] = [
  "HOD",
  "Teacher",
  "Tutor",
  "Class Advisor",
  "Dean"
];

// Maps a role to its dashboard route segment.
export const ROLE_ROUTE: Record<StaffRole, string> = {
  HOD: "hod",
  Teacher: "teacher",
  Tutor: "tutor",
  "Class Advisor": "class-advisor",
  "Dean": "dean"
};

// Roles that are scoped to a specific year + section rather than the
// whole department. HOD is the only department-wide role.
export const COHORT_SCOPED_ROLES: StaffRole[] = [
  "Teacher",
  "Tutor",
  "Class Advisor",
  "Dean"
];

export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  department: string;
  year: number | null;
  section: string | null;
}
