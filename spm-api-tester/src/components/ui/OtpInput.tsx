"use client";

import { useEffect, useRef, useState } from "react";

// Segmented OTP entry: auto-advance, backspace-back, full-code paste,
// numeric keypad on mobile, one-time-code autofill. `error` renders the
// inline message and clears the boxes.
export function OtpInput({
  length = 6,
  onComplete,
  error,
  errorKey = 0,
  disabled = false,
}: {
  length?: number;
  onComplete: (code: string) => void;
  error?: string | null;
  /** Bump on every failed attempt so identical error text still clears. */
  errorKey?: number;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const lastErrorKey = useRef(errorKey);

  // Each failed attempt clears the boxes and returns focus to the first one.
  useEffect(() => {
    if (error && errorKey !== lastErrorKey.current) {
      setDigits(Array(length).fill(""));
      refs.current[0]?.focus();
    }
    lastErrorKey.current = errorKey;
  }, [error, errorKey, length]);

  const commit = (next: string[]) => {
    setDigits(next);
    const code = next.join("");
    if (code.length === length && next.every((d) => d !== "")) {
      onComplete(code);
    }
  };

  const handleChange = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, "");
    if (!value) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    // Multi-character input = paste or autofill; spread it across the boxes.
    const next = [...digits];
    const chars = value.slice(0, length - index).split("");
    chars.forEach((char, offset) => {
      next[index + offset] = char;
    });
    const focusIndex = Math.min(index + chars.length, length - 1);
    refs.current[focusIndex]?.focus();
    commit(next);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      event.preventDefault();
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
      event.preventDefault();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
      event.preventDefault();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Verification code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1} of ${length}`}
            maxLength={length}
            className={`h-12 w-11 rounded-lg border bg-ink-50 text-center font-mono text-lg text-ink-950 focus:border-accent focus:outline-none disabled:bg-ink-100 ${
              error ? "border-error" : "border-ink-300"
            }`}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
