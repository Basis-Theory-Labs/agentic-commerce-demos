import { findScenario, type ScenarioStage } from "@/lib/scenarios";

// Reminder chip: the card was picked four steps ago — resurface the payoff
// exactly where the scenario manifests.
export function ScenarioChip({
  scenarioPan,
  stage,
}: {
  scenarioPan?: string;
  stage: ScenarioStage;
}) {
  const scenario = scenarioPan ? findScenario(scenarioPan) : undefined;
  if (!scenario || scenario.manifestsAt !== stage) return null;
  const tone =
    scenario.tone === "success"
      ? "border-success-border bg-success-soft text-success"
      : scenario.tone === "warning"
        ? "border-warning-border bg-warning-soft text-warning"
        : "border-error-border bg-error-soft text-error";
  return (
    <div className={`border px-3 py-2 text-xs ${tone}`}>
      <span className="font-mono text-[10px]">
        {scenario.pan.replace(/(\d{4})/g, "$1 ").trim()}
      </span>
      <span className="ml-2 text-ink-700">{scenario.reminder}</span>
    </div>
  );
}
