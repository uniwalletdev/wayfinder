"use client"

// The account affordance in the brand row. Deliberately small and optional:
// Findway works fully anonymously — like Google Maps or Apple Maps, you never
// have to sign in to find a ward — and signing in only adds the one thing that
// must follow a *person* rather than a device: ownership of the venues you map.
// A venue created anonymously is owned by a per-device edit_token; on sign-in
// this device's venues are claimed for the account (see
// db/migrations/0004_venue_owner.sql), so they can be edited from any device.
//
// Three states, in order of how most people will see it:
//   1. Clerk not configured  → a Help button (the accessibility and how-to
//                               page). A "?" circle that did nothing used to sit
//                               here, which on a hospital kiosk reads as broken.
//   2. Configured, signed out → the circle as a sign-in affordance.
//   3. Configured, signed in  → Clerk's <UserButton>.
//
// <Show> from @clerk/nextjs is an async *server* component and cannot be used
// here, so this reads session state through the client hook instead.

import Link from "next/link"
import { useEffect, useRef } from "react"
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"
import { User, HelpCircle } from "lucide-react"
import { claimServerVenues } from "@/lib/venues-server"
import { toast } from "@/components/Toast"

// NEXT_PUBLIC_* is inlined at build time, so the client can tell whether a
// ClerkProvider is mounted above it. Calling useUser() without one throws.
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const circle =
  "flex h-[34px] w-[34px] items-center justify-center rounded-full bg-wf-surface text-[13px] font-semibold text-wf-muted"

function HelpLink() {
  return (
    <Link href="/accessibility" className={`${circle} transition-colors hover:bg-wf-border`} title="Help and accessibility" aria-label="Help and accessibility">
      <HelpCircle size={16} aria-hidden="true" />
    </Link>
  )
}

function ClerkAuthButton({ initials }: { initials?: string | null }) {
  const { isLoaded, isSignedIn } = useUser()

  // Once per page life, when signed in: attach the venues this device created
  // to the account. Quiet unless something was actually claimed.
  const claimedRef = useRef(false)
  useEffect(() => {
    if (!isSignedIn || claimedRef.current) return
    claimedRef.current = true
    void claimServerVenues().then((n) => {
      if (n > 0) toast.success(`${n} place${n === 1 ? "" : "s"} you mapped now follow your account`, "Edit them from any device you sign in on.")
    })
  }, [isSignedIn])

  // Until Clerk has loaded — and that includes "offline, so it never will" —
  // show the anonymous circle rather than a spinner. Nothing here gates the map.
  if (!isLoaded || !isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className={`${circle} transition-colors hover:bg-wf-border`}
          title="Sign in (optional) to keep the venues you map on every device"
          aria-label="Sign in"
        >
          {isLoaded ? <User size={15} aria-hidden="true" /> : (initials ?? "?")}
        </button>
      </SignInButton>
    )
  }

  return <UserButton appearance={{ elements: { avatarBox: "h-[34px] w-[34px]" } }} />
}

export default function AuthButton({ initials }: { initials?: string | null }) {
  if (!clerkEnabled) return <HelpLink />
  return <ClerkAuthButton initials={initials} />
}
