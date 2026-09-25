// Who is signed in, for the API routes. Sign-in is optional (Clerk, only when
// its keys are set), so this is null far more often than not — a device-only
// deployment, a signed-out visitor, or a request Clerk could not verify — and
// every caller treats null as "anonymous", never as an error.
//
// Imported lazily so a deployment without Clerk never loads its server SDK.

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY

export async function currentUserId(): Promise<string | null> {
  if (!clerkEnabled) return null
  try {
    const { auth } = await import("@clerk/nextjs/server")
    const { userId } = await auth()
    return userId ?? null
  } catch {
    return null
  }
}
