"use client";

interface Props {
  onNewCard: () => void;
  onSavedCard: () => void;
}

export default function PaymentChoice({ onNewCard, onSavedCard }: Props) {
  const base =
    "border border-ink-300 hover:bg-ink-900 hover:text-white hover:border-ink-900 bg-white text-ink-900 text-sm font-medium py-3 transition-colors";
  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={onNewCard} className={base}>
        New Card
      </button>
      <button onClick={onSavedCard} className={base}>
        Saved Card
      </button>
    </div>
  );
}
