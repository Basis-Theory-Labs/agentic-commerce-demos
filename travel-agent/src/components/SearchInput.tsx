"use client";

import { useState } from "react";

interface Props {
  onSearch: (query: string) => void;
  placeholder?: string;
  examples?: string[];
}

export default function SearchInput({ onSearch, placeholder, examples }: Props) {
  const [value, setValue] = useState("");

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
          setValue("");
        }}
        className="flex gap-2"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "Where would you like to fly?"}
          className="flex-1 border border-ink-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 bg-white"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium px-5 rounded-xl transition-colors flex items-center gap-1"
        >
          Search
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>

      {examples && examples.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => submit(ex)}
              className="text-xs text-ink-500 hover:text-sky-700 border border-ink-100 hover:border-sky-500 rounded-full px-3 py-1.5 bg-white transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
