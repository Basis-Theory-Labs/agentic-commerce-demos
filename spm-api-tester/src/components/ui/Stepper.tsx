"use client";

// Compact, horizontally scrollable wizard stages with done-checks.
export interface StepDef {
  id: string;
  title: string;
}

export function Stepper({
  steps,
  currentId,
  doneIds,
  reachableIds,
  onSelect,
}: {
  steps: StepDef[];
  currentId: string;
  doneIds: Set<string>;
  /** Steps navigable right now (completed or prerequisites satisfied). */
  reachableIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentId);
  return (
    <nav aria-label="Flow steps" className="bg-surface/95">
      <div className="flex items-center gap-3 px-4 sm:px-6">
        <ol className="flex min-w-0 flex-1 overflow-x-auto py-1">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentId;
            const isDone = doneIds.has(step.id);
            const isReachable = reachableIds.has(step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => isReachable && onSelect(step.id)}
                  disabled={!isReachable}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-accent-soft text-accent"
                      : isReachable
                        ? "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                        : "text-ink-400"
                  } disabled:cursor-not-allowed`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold ${
                      isCurrent
                        ? "bg-accent text-accent-foreground"
                        : isDone
                          ? "bg-success-soft text-success"
                          : "border border-ink-300 text-ink-500"
                    }`}
                  >
                    {isDone && !isCurrent ? "✓" : index + 1}
                  </span>
                  {step.title}
                </button>
              </li>
            );
          })}
        </ol>
        <span className="hidden shrink-0 text-xs text-ink-500 lg:block">
          Step {currentIndex + 1} of {steps.length}
        </span>
      </div>
    </nav>
  );
}
