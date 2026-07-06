"use client"

interface Props {
  on: boolean
  onChange: (next: boolean) => void
  label?: string
  "aria-label"?: string
}

// 42x24 pill switch, teal when on — used by the step-free routing preference
// and the share dialog's "opens the step-free route" toggle.
export default function Toggle({ on, onChange, label, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={rest["aria-label"] ?? label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-[42px] flex-shrink-0 rounded-full p-0.5 transition-colors duration-200 ${
        on ? "bg-wf-teal" : "bg-wf-border"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          on ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  )
}
