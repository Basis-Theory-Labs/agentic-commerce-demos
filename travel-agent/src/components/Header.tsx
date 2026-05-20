"use client";

import Image from "next/image";

export default function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="sticky top-0 z-20 bg-ink-900 h-14 flex items-center">
      <div className="max-w-3xl mx-auto px-4 w-full flex items-center justify-between">
        <button
          onClick={onReset}
          className="flex items-center gap-2.5 group"
          aria-label="Start over"
        >
          <Image
            src="/skyagent-logo.png"
            alt="SkyAgent"
            width={66}
            height={44}
            priority
            className="invert -my-2"
            style={{ width: "auto", height: "44px" }}
          />
          <span className="font-display font-semibold text-xl text-white leading-tight tracking-tight">
            SkyAgent
          </span>
        </button>
      </div>
    </header>
  );
}
