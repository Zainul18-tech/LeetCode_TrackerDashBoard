import { createBrowserClient } from "@supabase/ssr";

// Name of the profile table described in the DB schema:
// id (uuid, pk) · name · email (unique) · role · department · year · section
// Change this in one place if your table is named differently.
export const STAFF_TABLE = "staff";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
