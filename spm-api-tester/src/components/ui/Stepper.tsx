"use client";

// Wizard stepper: numerals with done-checks and an explicit "step n of m"
// affordance. The current step is a solid block — deliberately distinct from
// the underline styling in-page tabs use.
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
    <nav aria-label="Flow steps" className="border-b border-ink-200 bg-white">
      <div className="flex items-center justify-between px-4">
        <ol className="flex flex-wrap">
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
                  className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-ink-900 text-white"
                      : isReachable
                        ? "text-ink-600 hover:text-ink-900"
                        : "text-ink-300"
                  } disabled:cursor-not-allowed`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center text-[10px] font-semibold ${
                      isCurrent
                        ? "bg-white text-ink-900"
                        : isDone
                          ? "bg-success text-white"
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
        <span className="hidden shrink-0 text-[11px] text-ink-500 sm:block">
          Step {currentIndex + 1} of {steps.length}
        </span>
      </div>
    </nav>
  );
}
