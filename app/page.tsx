import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-dim dark:text-signal">
        Dr.NGP Institute of Technology
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-black dark:text-zinc-50">
        LeetCode Tracker
      </h1>
      <p className="mt-3 max-w-md text-zinc-500">
        One console for HOD, Teacher, Tutor, and Class Advisor to follow
        student problem-solving progress.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-white/[.04]"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
