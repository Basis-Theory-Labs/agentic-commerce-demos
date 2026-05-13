"use client";

import { ReactNode } from "react";

interface Props {
  role: "user" | "assistant";
  children: ReactNode;
}

// User → black bubble, white text. Assistant → renders children directly so
// the page can style its own white/border bubbles + drop arbitrary inline
// components (flight list, card picker, etc.) below them. No avatar — the
// colour inversion of user vs. assistant is the only role marker.
export default function ChatMessage({ role, children }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-ink-900 text-white px-4 py-2.5 max-w-[80%] text-sm">
          {children}
        </div>
      </div>
    );
  }

  return <div className="space-y-3">{children}</div>;
}
