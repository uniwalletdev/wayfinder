"use client"
import { useState } from "react"
import { Lock, Ban, Trash2, RotateCcw } from "lucide-react"
import { useAdmin, adminSend, useDebounced, PageHeader, Card, Table, Td, Badge, SearchBox, Pager, Loading, ErrorState, Empty, Notice, ConfirmDialog, type ConfirmRequest, fmtAgo, fmtNumber, errorText } from "../ui"
import { useStaff } from "../AdminShell"
import { toast } from "@/components/Toast"
import { ROLE_LABELS, ROLE_SUMMARIES, ROLES, assignableRoles, checkBan, checkDelete, checkRoleChange, type RoleOrNone, type Role } from "@/lib/backoffice/roles"

interface Account {
  id: string
  name: string
  email: string | null
  emailVerified: boolean
  imageUrl: string | null
  createdAt: string
  lastSignInAt: string | null
  banned: boolean
  role: RoleOrNone
  fixedOwner: boolean
  venues: number
}
interface TeamMember {
  userId: string | null
  email: string
  name: string | null
  role: RoleOrNone
  fixedOwner: boolean
  lastSignInAt: string | null
  banned: boolean
}
interface UsersData {
  clerk: boolean
  team: TeamMember[]
  accounts: Account[]
  total: number
  page: number
  perPage: number
}

const ROLE_TONE: Record<RoleOrNone, "primary" | "teal" | "green" | "neutral"> = { owner: "primary", admin: "teal", editor: "green", viewer: "neutral", none: "neutral" }

function RoleBadge({ role, fixed }: { role: RoleOrNone; fixed?: boolean }) {
  return (
    <Badge tone={ROLE_TONE[role]} title={fixed ? "Set by ADMIN_EMAILS on the deployment" : undefined}>
      {fixed && <Lock size={11} aria-hidden="true" />}
      {ROLE_LABELS[role]}
    </Badge>
  )
}

export default function UsersView() {
  const staff = useStaff()
  const actor = { userId: staff.userId, role: staff.role }
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const query = useDebounced(q)
  const params = new URLSearchParams({ page: String(page) })
  if (query) params.set("q", query)
  const { data, error, loading, reload } = useAdmin<UsersData>(`/api/admin/users?${params}`)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const changeRole = async (a: Account, role: RoleOrNone) => {
    const go = async () => {
      setBusy(a.id)
      try {
        await adminSend("PATCH", `/api/admin/users/${a.id}`, { role })
        toast.success(`${a.email ?? a.name} is now ${ROLE_LABELS[role].toLowerCase()}`)
        reload()
      } catch (err) {
        toast.error("Could not change the role", errorText(err))
      } finally {
        setBusy(null)
      }
    }
    // Handing out admin or owner is worth a second look.
    if (role === "owner" || role === "admin") {
      setConfirm({
        title: `Make ${a.email ?? a.name} ${ROLE_LABELS[role].toLowerCase()}?`,
        body: <>{ROLE_SUMMARIES[role]}.</>,
        confirmLabel: `Make ${ROLE_LABELS[role].toLowerCase()}`,
        run: go,
      })
    } else await go()
  }

  return (
    <>
      <PageHeader title="Users & roles" description="Everyone with a Findway account, and who can use this back office. Most people never sign in — Findway works without an account — so this lists those who did: to keep the venues they map, or to work here." />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card title="Back office team">
          {!data ? (
            error ? <ErrorState error={error} onRetry={reload} /> : <Loading />
          ) : data.team.length === 0 ? (
            <p className="text-[13.5px] text-wf-muted">No one has a role yet.</p>
          ) : (
            <ul className="divide-y divide-wf-border-faint">
              {data.team.map((m) => (
                <li key={`${m.userId ?? ""}|${m.email}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-wf-ink">{m.name ?? m.email}</p>
                    <p className="truncate text-[12.5px] text-wf-muted">
                      {m.name ? `${m.email} · ` : ""}
                      {m.userId ? `last signed in ${fmtAgo(m.lastSignInAt)}` : "has not signed in yet"}
                      {m.banned ? " · banned" : ""}
                    </p>
                  </div>
                  <RoleBadge role={m.role} fixed={m.fixedOwner} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="What each role can do">
          <ul className="space-y-3">
            {ROLES.map((r: Role) => (
              <li key={r}>
                <RoleBadge role={r} />
                <p className="mt-1 text-[13px] leading-snug text-wf-muted">{ROLE_SUMMARIES[r]}.</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-wf-border-faint pt-3 text-[12.5px] text-wf-faint">
            <Lock size={11} className="mr-1 inline" aria-hidden="true" />
            Owners listed in ADMIN_EMAILS on the deployment are fixed and can only be changed there.
          </p>
        </Card>
      </div>

      <div className="mb-4 mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-[18px] font-semibold text-wf-ink">All accounts {data?.clerk ? <span className="text-wf-muted">· {fmtNumber(data.total)}</span> : null}</h2>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search by name or email" />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : !data.clerk ? (
        <Notice title="Accounts are not set up on this deployment">Add the Clerk keys to the host&apos;s environment variables to list, ban or give roles to accounts.</Notice>
      ) : (
        <>
          <Table
            head={["Account", "Role", "Status", "Venues", "Last sign-in", "Joined", ""]}
            empty={data.accounts.length === 0 ? <Empty title={q ? "No accounts match" : "No accounts yet"} /> : null}
          >
            {data.accounts.map((a) => {
              const target = { userId: a.id, role: a.role, fixedOwner: a.fixedOwner }
              const roleOptions = assignableRoles(staff.role).filter((r) => r === a.role || checkRoleChange(actor, target, r) === null)
              const canRole = roleOptions.length > 1 && checkRoleChange(actor, target, roleOptions.find((r) => r !== a.role) ?? a.role) === null
              const banRefusal = checkBan(actor, target)
              const deleteRefusal = checkDelete(actor, target)
              const isSelf = a.id === staff.userId
              return (
                <tr key={a.id} className={busy === a.id || loading ? "opacity-60" : ""}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      {a.imageUrl ? (
                        // Clerk serves avatars from its own CDN; next/image would need it allow-listed.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full bg-wf-surface object-cover" />
                      ) : (
                        <span className="h-8 w-8 flex-shrink-0 rounded-full bg-wf-surface" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-wf-ink">
                          {a.name}
                          {isSelf && <span className="ml-1.5 text-[12px] font-normal text-wf-muted">(you)</span>}
                        </p>
                        <p className="truncate text-[12.5px] text-wf-muted">
                          {a.email ?? "no email"}
                          {a.email && !a.emailVerified ? " · unverified" : ""}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {canRole ? (
                      <select
                        value={a.role}
                        aria-label={`Role of ${a.email ?? a.name}`}
                        disabled={busy === a.id}
                        onChange={(e) => changeRole(a, e.target.value as RoleOrNone)}
                        className="rounded-lg border border-wf-border bg-white px-2 py-1 text-[13px]"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {r === "none" ? "No role" : ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={a.role} fixed={a.fixedOwner} />
                    )}
                  </Td>
                  <Td>{a.banned ? <Badge tone="red">Banned</Badge> : <Badge tone="green">Active</Badge>}</Td>
                  <Td>{fmtNumber(a.venues)}</Td>
                  <Td className="whitespace-nowrap text-wf-muted">{fmtAgo(a.lastSignInAt)}</Td>
                  <Td className="whitespace-nowrap text-wf-muted">{fmtAgo(a.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {banRefusal === null && (
                        <button
                          className={`rounded-lg p-1.5 text-wf-muted ${a.banned ? "hover:bg-wf-surface hover:text-wf-primary" : "hover:bg-red-50 hover:text-red-600"}`}
                          aria-label={a.banned ? `Unban ${a.email ?? a.name}` : `Ban ${a.email ?? a.name}`}
                          title={a.banned ? "Unban" : "Ban"}
                          onClick={() =>
                            setConfirm({
                              title: a.banned ? `Unban ${a.email ?? a.name}?` : `Ban ${a.email ?? a.name}?`,
                              body: a.banned ? "They will be able to sign in again." : "They are signed out everywhere and cannot sign in until unbanned. Their venues stay as they are.",
                              confirmLabel: a.banned ? "Unban" : "Ban account",
                              danger: !a.banned,
                              run: async () => {
                                await adminSend("PATCH", `/api/admin/users/${a.id}`, { banned: !a.banned })
                                toast.success(a.banned ? `${a.email ?? a.name} unbanned` : `${a.email ?? a.name} banned`)
                                reload()
                              },
                            })
                          }
                        >
                          {a.banned ? <RotateCcw size={15} /> : <Ban size={15} />}
                        </button>
                      )}
                      {deleteRefusal === null && (
                        <button
                          className="rounded-lg p-1.5 text-wf-muted hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete ${a.email ?? a.name}`}
                          title="Delete account"
                          onClick={() =>
                            setConfirm({
                              title: `Delete ${a.email ?? a.name}?`,
                              body: (
                                <>
                                  The account is deleted for good — use this for a request to erase someone&apos;s data. Their {a.venues} venue{a.venues === 1 ? "" : "s"} stay, but no longer belong to anyone.
                                </>
                              ),
                              confirmLabel: "Delete account",
                              danger: true,
                              typeToConfirm: a.email ?? a.id,
                              run: async () => {
                                await adminSend("DELETE", `/api/admin/users/${a.id}`)
                                toast.success(`${a.email ?? a.name} deleted`)
                                reload()
                              },
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
          </Table>
          <Pager page={data.page} perPage={data.perPage} total={data.total} onPage={setPage} />
        </>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
