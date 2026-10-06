// What people can tell the team, shared by the forms that send it (the
// report dialog in the app, the support page), the API that stores it
// (/api/feedback) and the back office Inbox that lists it. Pure.

export type FeedbackKind = "report" | "support"
export type FeedbackSource = "web" | "ios" | "android"

export const REPORT_REASONS = [
  { value: "offensive", label: "Offensive or inappropriate" },
  { value: "spam", label: "Spam or advertising" },
  { value: "misleading", label: "Wrong or misleading" },
  { value: "permission", label: "Published without permission" },
  { value: "other", label: "Something else" },
] as const

export const SUPPORT_TOPICS = [
  { value: "using", label: "Using the app" },
  { value: "map", label: "A map is wrong or missing" },
  { value: "privacy", label: "Privacy or my data" },
  { value: "accessibility", label: "Accessibility" },
  { value: "other", label: "Something else" },
] as const

export const FEEDBACK_MESSAGE_MAX = 2000
export const FEEDBACK_EMAIL_MAX = 254

export function topicsFor(kind: FeedbackKind): readonly { value: string; label: string }[] {
  return kind === "report" ? REPORT_REASONS : SUPPORT_TOPICS
}

export function isTopic(kind: FeedbackKind, topic: unknown): topic is string {
  return typeof topic === "string" && topicsFor(kind).some((t) => t.value === topic)
}

export function topicLabel(kind: FeedbackKind, topic: string): string {
  return topicsFor(kind).find((t) => t.value === topic)?.label ?? topic
}

// Enough to catch a typo before it costs someone their reply.
export function isEmail(value: string): boolean {
  return value.length <= FEEDBACK_EMAIL_MAX && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
}
