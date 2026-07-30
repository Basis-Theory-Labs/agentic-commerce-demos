"use client";

// Wizard stepper: roomy, horizontally scrollable stages with done-checks and
// an explicit "step n of m" affordance.
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
      <div className="flex items-center gap-4 px-5 sm:px-8">
        <ol className="flex min-w-0 flex-1 overflow-x-auto py-2">
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
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isCurrent
                      ? "bg-accent-soft text-accent"
                      : isReachable
                        ? "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                        : "text-ink-400"
                  } disabled:cursor-not-allowed`}
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold ${
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
