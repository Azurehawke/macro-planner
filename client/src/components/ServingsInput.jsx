import React, { useEffect, useState } from 'react';

const STEP = 0.25;

// A +/- stepper with a directly-editable number field, replacing the old
// drag slider - on mobile, a native range input claims any touch drag that
// starts on it, so a finger just passing over it while scrolling the page
// got read as a drag and jumped the value. Typing or tapping +/- can't be
// triggered by an incidental touch the way a slider can.
//
// `onChange` fires on every valid keystroke/step so the caller can update a
// live macros preview; `onCommit` fires once editing is "done" (blur, Enter,
// or a +/- tap) and is when the value should actually be saved.
export default function ServingsInput({ value, max = 10, onChange, onCommit }) {
  const [text, setText] = useState(value.toFixed(2));

  // Stay in sync if the committed value changes from elsewhere (e.g. another
  // tab, or the server round-trip after a commit).
  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  const clamp = (n) => Math.max(0, Math.min(max, n));

  const handleTextChange = (raw) => {
    setText(raw);
    const num = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(num)) {
      onChange(clamp(num));
    }
  };

  const commitText = () => {
    const num = Number(text);
    const clamped = Number.isFinite(num) ? clamp(num) : value;
    setText(clamped.toFixed(2));
    onCommit(clamped);
  };

  const step = (delta) => {
    const base = Number(text);
    const next = clamp(Math.round(((Number.isFinite(base) ? base : value) + delta) * 100) / 100);
    setText(next.toFixed(2));
    onChange(next);
    onCommit(next);
  };

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => step(-STEP)}
        aria-label="Decrease servings"
        className="h-9 w-9 shrink-0 rounded-full border dark:border-slate-600 text-lg font-semibold leading-none hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        max={max}
        step="0.05"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-20 text-center text-lg font-semibold border dark:border-slate-600 dark:bg-slate-900 rounded px-2 py-1"
      />
      <button
        type="button"
        onClick={() => step(STEP)}
        aria-label="Increase servings"
        className="h-9 w-9 shrink-0 rounded-full border dark:border-slate-600 text-lg font-semibold leading-none hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        +
      </button>
    </div>
  );
}
