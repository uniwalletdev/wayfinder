import { ROLE_LABELS, type RoleOrNone } from "@/lib/backoffice/roles"

// One readable line per back office change.
export function actionLabel(action: string, detail: Record<string, unknown> = {}): string {
  const s = (k: string) => (typeof detail[k] === "string" ? (detail[k] as string) : "")
  const role = (k: string) => ROLE_LABELS[(s(k) || "none") as RoleOrNone] ?? s(k)
  switch (action) {
    case "venue.update": {
      const parts = [] as string[]
      if (s("visibility")) parts.push(`made ${s("visibility")}`)
      if (typeof detail.verified === "boolean") parts.push(detail.verified ? "verified" : "unverified")
      return `Venue “${s("name")}” ${parts.join(" and ") || "updated"}`
    }
    case "venue.delete":
      return `Venue “${s("name")}” deleted`
    case "search.resolve":
      return `Search “${s("query")}” marked resolved`
    case "search.reopen":
      return `Search “${s("query")}” reopened`
    case "user.role":
      return `${s("email") || "An account"}: ${role("from")} → ${role("to")}`
    case "user.ban":
      return `${s("email") || "An account"} banned`
    case "user.unban":
      return `${s("email") || "An account"} unbanned`
    case "user.delete":
      return `${s("email") || "An account"} deleted`
    case "data.purge_signals":
      return `Navigation signals older than ${String(detail.olderThanDays ?? "?")} days deleted (${String(detail.deleted ?? 0)})`
    case "data.refresh":
      return `Data refresh started for ${s("countries")}`
    default:
      return action
  }
}

export const ACTION_GROUPS = [
  { value: "", label: "All changes" },
  { value: "venue.", label: "Venues" },
  { value: "search.", label: "Searches" },
  { value: "user.", label: "Accounts" },
  { value: "data.", label: "Data" },
]
