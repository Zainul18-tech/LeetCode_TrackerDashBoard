"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justRegistered = params.get("confirm") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      setError(signInError?.message || "Invalid email or password.");
      setLoading(false);
      return;
    }

    setLoading(false);

    // Middleware will decide:
    // Staff -> /dashboard/staff
    // Admin -> /dashboard/admin
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="w-full max-w-md">
        <p className="text-center font-mono text-xs uppercase tracking-[0.3em] text-gray-400">
          DR.NGP INSTITUTE OF TECHNOLOGY
        </p>

        <h1 className="mt-4 text-center text-5xl font-bold text-white">
          LeetCode Tracker
        </h1>

        <p className="mt-4 text-center text-lg text-gray-400">
          Sign in to continue
        </p>

        {justRegistered && (
          <div className="mt-6 rounded-xl border border-green-600/40 bg-green-500/10 p-4 text-center text-sm text-green-400">
            Registration successful. Please sign in.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Email Address
            </label>

            <input
              type="email"
              required
              value={email}
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-white placeholder:text-zinc-500 outline-none transition focus:border-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-white placeholder:text-zinc-500 outline-none transition focus:border-white"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-14 w-full rounded-full border border-zinc-700 bg-white text-lg font-semibold text-black transition duration-300 hover:scale-[1.02] hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}