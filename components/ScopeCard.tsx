export default function ScopeCard({
  eyebrow,
  scope,
  widgets,
}: {
  eyebrow: string;
  scope: string;
  widgets: string[];
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
        {scope}
      </h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {widgets.map((title) => (
          <div
            key={title}
            className="rounded-xl border border-dashed border-zinc-300 p-6 dark:border-zinc-800"
          >
            <p className="text-sm font-medium text-black dark:text-zinc-50">
              {title}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              No data wired up yet — connect this card to your submissions
              table to populate it.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
