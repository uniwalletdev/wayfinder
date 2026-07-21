"use client"

// The account affordance in the brand row. Deliberately small and optional:
// Wayfinder works fully anonymously — like Google Maps or Apple Maps, you never
// have to sign in to find a ward — and signing in only adds things that must
// follow a *person* rather than a device: saved places, and ownership of a venue
// you mapped (today that ownership is a per-device edit_token, so clearing
// storage loses it permanently; see db/migrations/0003_venues.sql).
//
// Three states, in order of how most people will see it:
//   1. Clerk not configured  → the plain initials circle, exactly as before.
//   2. Configured, signed out → the same circle, now a sign-in affordance.
//   3. Configured, signed in  → Clerk's <UserButton>.
//
// <Show> from @clerk/nextjs is an async *server* component and cannot be used
// here, so this reads session state through the client hook instead.

import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { User } from "lucide-react"

// NEXT_PUBLIC_* is inlined at build time, so the client can tell whether a
// ClerkProvider is mounted above it. Calling useUser() without one throws.
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const circle =
  "flex h-[34px] w-[34px] items-center justify-center rounded-full bg-wf-surface text-[13px] font-semibold text-wf-muted"

function InitialsCircle({ initials }: { initials?: string | null }) {
  return <div className={circle}>{initials ?? "?"}</div>
}

function ClerkAuthButton({ initials }: { initials?: string | null }) {
  const { isLoaded, isSignedIn } = useUser()

  // Until Clerk has loaded — and that includes "offline, so it never will" —
  // show the anonymous circle rather than a spinner. Nothing here gates the map.
  if (!isLoaded || !isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className={`${circle} transition-colors hover:bg-wf-border`}
          title="Sign in to save places and keep the venues you map"
          aria-label="Sign in"
        >
          {isLoaded ? <User size={15} /> : (initials ?? "?")}
        </button>
      </SignInButton>
    )
  }

  return <UserButton appearance={{ elements: { avatarBox: "h-[34px] w-[34px]" } }} />
}

export default function AuthButton({ initials }: { initials?: string | null }) {
  if (!clerkEnabled) return <InitialsCircle initials={initials} />
  return <ClerkAuthButton initials={initials} />
}
