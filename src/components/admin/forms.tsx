"use client"

import { useActionState, useRef, type ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import type { ActionState } from "@/lib/admin/types"

// The interactive half of the portal: forms that call Server Actions, and the
// filter bars that drive the URL.
//
// Everything here is deliberately thin. The pages are Server Components and the
// data never leaves the server; these components exist only to (a) show that
// something is in flight and (b) put the result of an action next to the control
// that caused it. There is no client-side store, no optimistic state and no
// fetch — the action mutates, calls refresh(), and the server re-renders the
// truth.

/**
 * A submit button that knows when its form is in flight.
 *
 * useFormStatus reads the state of the nearest parent <form>, which is why this
 * has to be its own component rather than a prop on the form.
 */
export function SubmitButton({
  children,
  className,
  pendingLabel = "Working…",
  confirm,
  name,
  value,
}: {
  children: ReactNode
  className: string
  pendingLabel?: string
  /** When set, the browser asks this before the form is allowed to submit. */
  confirm?: string
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={className}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault()
            }
          : undefined
      }
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

/** What an action said, rendered where the operator is already looking. */
export function Feedback({ state }: { state: ActionState }) {
  if (!state) return null
  const Icon = state.ok ? CheckCircle2 : AlertTriangle
  return (
    <p
      role="status"
      className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed ${
        state.ok ? "bg-wf-green-tint text-wf-green-text" : "bg-[#FDEDEC] text-[#B3261E]"
      }`}
    >
      <Icon size={15} className="mt-0.5 flex-shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{state.message}</span>
    </p>
  )
}

export type ServerAction = (prev: ActionState, form: FormData) => Promise<ActionState>

/**
 * A form bound to a Server Action, with the action's reply rendered underneath.
 *
 * `children` may be a render function when a control needs to react to the
 * result — the token rotation panel, for instance, only has something to show
 * once the action has run.
 */
export function ActionForm({
  action,
  children,
  className,
  hidden,
}: {
  action: ServerAction
  children: ReactNode | ((state: ActionState) => ReactNode)
  className?: string
  /** Fixed values the action needs, e.g. the id of the row being changed. */
  hidden?: Record<string, string>
}) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className={className}>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
        : null}
      {typeof children === "function" ? children(state) : children}
      <Feedback state={state} />
    </form>
  )
}

/**
 * A filter bar that is an ordinary GET form.
 *
 * The filters live in the URL, which is the property that matters: a moderation
 * queue someone is working through can be bookmarked, shared with a colleague,
 * and reloaded without losing where they were. Selects submit as soon as they
 * change; everything still works with JavaScript off, because the fallback is
 * the submit button that is already there.
 */
export function FilterForm({
  action,
  children,
  className = "",
}: {
  action: string
  children: ReactNode
  className?: string
}) {
  const form = useRef<HTMLFormElement>(null)
  return (
    <form
      ref={form}
      method="get"
      action={action}
      className={className}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") form.current?.requestSubmit()
      }}
    >
      {children}
    </form>
  )
}
