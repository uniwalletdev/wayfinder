import Link from "next/link"
import { Navigation, Map, ArrowRight, Search, ClipboardList } from "lucide-react"

const NAV_LINKS = ["Product", "Hospitals", "For trusts", "Help"]
const TRUST_ITEMS = ["A&E", "Outpatients", "Wards", "Pharmacy", "X-Ray & Imaging", "Maternity"]

const FEATURES = [
  {
    Icon: Search,
    tile: "bg-wf-primary",
    title: "Search any ward or clinic",
    body: "Type a ward, a clinic or a department. Every floor of the hospital ranks in one list, nearest first — no more squinting at wall signs.",
  },
  {
    Icon: Navigation,
    tile: "bg-wf-teal",
    title: "Follow the line",
    body: "Turn-by-turn guidance across floors — lifts included — with live re-routing the moment you take a wrong turn.",
  },
  {
    Icon: ClipboardList,
    tile: "bg-wf-ink",
    title: "Map it yourself",
    body: "Estates teams walk an area or upload a floor plan — the route becomes the corridor layout, and signs are read straight from footage.",
  },
]

export default function Landing() {
  return (
    <main className="bg-white">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[600px] overflow-hidden bg-wf-ink-hero pb-16 lg:h-[780px] lg:pb-0">
        <HeroMap />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(7,15,27,0.92) 0%, rgba(7,15,27,0.78) 38%, rgba(7,15,27,0.15) 70%, rgba(7,15,27,0) 100%)" }}
        />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between gap-4 px-6 pt-9 sm:px-10 lg:px-16 xl:px-24">
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
              <Navigation size={17} className="text-white" />
            </span>
            <span className="font-display text-xl font-bold text-white">Wayfinder</span>
          </div>
          <div className="hidden items-center gap-9 xl:flex">
            {NAV_LINKS.map((link) => (
              <span key={link} className="text-[14.5px] font-medium text-white/85">{link}</span>
            ))}
          </div>
          <Link
            href="/navigate"
            className="flex flex-shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-wf-ink transition-transform active:scale-95"
          >
            Open the map
            <ArrowRight size={15} />
          </Link>
        </nav>

        {/* Copy */}
        <div className="relative z-10 max-w-[640px] px-6 pt-14 sm:px-10 sm:pt-20 lg:px-16 xl:max-w-[820px] xl:px-24 xl:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,201,255,0.35)] bg-[rgba(34,201,255,0.08)] px-3.5 py-1.5 text-[13px] text-[#8FDFFF]">
            <span className="h-[7px] w-[7px] rounded-full bg-wf-route-cyan" />
            Wayfinding for NHS hospitals
          </span>
          <h1 className="mt-6 font-display text-[40px] font-bold leading-[1.08] -tracking-[1.2px] text-white sm:text-[52px] sm:-tracking-[1.6px] xl:text-[60px] xl:leading-[1.06] xl:-tracking-[1.8px]">
            Every NHS hospital, mapped.
            <br />
            Every appointment, <span className="whitespace-nowrap">on time.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/72 sm:text-[19px]">
            A hospital is the easiest place in Britain to get lost — and the worst place to be late. Wayfinder maps
            NHS hospitals floor by floor, then walks patients, visitors and staff from the front door to the right
            ward, clinic or bedside — one clear step at a time.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/navigate"
              className="flex items-center justify-center gap-2 rounded-2xl bg-wf-primary px-7 py-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(10,93,194,0.45)] transition-transform active:scale-95"
            >
              <Navigation size={17} />
              Start navigating
            </Link>
            <Link
              href="/map"
              className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-white/35 px-7 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60"
            >
              <Map size={17} />
              Map your hospital
            </Link>
          </div>
        </div>

        {/* Floating route card */}
        <div className="absolute right-6 top-[120px] z-10 hidden w-80 rounded-[20px] bg-white/97 p-5 shadow-[0_24px_60px_rgba(11,27,46,0.25)] backdrop-blur sm:right-10 lg:right-16 xl:right-24 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl bg-[#E7F2FF]">
              <Map size={19} className="text-wf-primary" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-wf-ink">Cardiology, Level 4</p>
              <p className="truncate text-xs text-wf-muted">Great Ormond Street Hospital</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-wf-surface px-3 py-2.5 text-center">
              <p className="font-display text-[15px] font-bold text-wf-ink">6 min</p>
              <p className="text-[11px] text-wf-muted">on foot</p>
            </div>
            <div className="rounded-xl bg-wf-surface px-3 py-2.5 text-center">
              <p className="font-display text-[15px] font-bold text-wf-ink">410 m</p>
              <p className="text-[11px] text-wf-muted">2 floors up</p>
            </div>
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]">
            <Navigation size={16} />
            Start guidance
          </button>
        </div>

        {/* Floating floor capsule */}
        <div className="absolute right-[352px] top-[340px] z-10 hidden flex-col gap-1 rounded-full bg-white/97 p-2 sm:right-[392px] lg:right-[432px] xl:right-[456px] lg:flex">
          {["L5", "L4", "L3", "L2"].map((f) => (
            <span
              key={f}
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-full font-display text-[13px] font-bold ${
                f === "L4" ? "bg-wf-primary text-white shadow-[0_4px_12px_rgba(10,93,194,0.4)]" : "text-wf-muted"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      <section className="border-b border-[#E8EDF4] px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.1em] text-wf-faint">Guiding patients to</p>
        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {TRUST_ITEMS.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#E8EDF4] bg-wf-surface-2 px-4 py-2 font-display text-[13.5px] font-semibold text-wf-body sm:px-5 sm:text-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="px-6 pb-[88px] pt-24 sm:px-10 lg:px-16 xl:px-24">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-wf-primary">How it works</p>
        <h2 className="mt-3 max-w-2xl font-display text-[32px] font-bold leading-[1.12] -tracking-[0.5px] text-wf-ink sm:text-[38px] lg:text-[44px] lg:leading-[1.1] lg:-tracking-[1px]">
          From front door to final room, in three moves
        </h2>
        <p className="mt-4 max-w-xl text-base text-wf-muted">
          No beacons, no hardware. Wayfinder fuses GPS, your steps and your compass to keep the blue dot
          moving — even deep inside the building, where satellites can&apos;t see you.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map(({ Icon, tile, title, body }) => (
            <div key={title} className="rounded-[20px] border border-[#E8EDF4] bg-wf-surface-2 p-8">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tile}`}>
                <Icon size={22} className="text-white" />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold text-wf-ink">{title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-wf-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dark band: 2D · 3D · Every level ─────────────────────────────── */}
      <section className="grid grid-cols-1 gap-16 bg-wf-ink px-6 py-[88px] sm:px-10 lg:grid-cols-2 lg:items-center lg:px-16 xl:px-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-wf-route-cyan">2D · 3D · Every level</p>
          <h2 className="mt-3 font-display text-[30px] font-bold leading-[1.14] -tracking-[0.5px] text-white sm:text-[36px] lg:text-[40px] lg:leading-[1.12] lg:-tracking-[1px]">
            One map that knows about floors
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/65">
            Flip between a flat plan and a rotatable building model. The floor rail keeps you oriented, and routes
            carry across levels — &ldquo;take Lift A to 2&rdquo; is a single step, not a leap of faith.
          </p>
          <div className="mt-7 inline-flex rounded-full bg-white/8 p-1" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>
            <span className="rounded-full bg-white px-[22px] py-2 text-sm font-semibold text-wf-ink">2D</span>
            <span className="rounded-full px-[22px] py-2 text-sm font-semibold text-white/75">3D</span>
          </div>
        </div>

        <div className="relative hidden h-[340px] lg:block">
          <div
            className="absolute left-[60px] top-9 h-[200px] w-[380px]"
            style={{ transform: "rotateX(58deg) rotateZ(-42deg)", transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 rounded-xl border-[1.5px] border-[rgba(34,201,255,0.35)] bg-[rgba(34,201,255,0.06)]" style={{ transform: "translateZ(0px)" }} />
            <div className="absolute inset-0 rounded-xl border-[1.5px] border-[rgba(34,201,255,0.5)] bg-[rgba(34,201,255,0.1)]" style={{ transform: "translateZ(56px)" }} />
            <div
              className="absolute inset-0 rounded-xl border-[1.5px] border-wf-teal bg-[rgba(15,181,174,0.14)]"
              style={{ transform: "translateZ(112px)", boxShadow: "0 0 40px rgba(15,181,174,0.35)" }}
            />
          </div>
          <div className="absolute right-6 top-6 flex flex-col gap-1.5">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/16 bg-white/8 font-display text-xs font-bold text-white/70">3</span>
            <div className="flex items-center gap-2">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-wf-teal font-display text-xs font-bold text-white shadow-[0_6px_16px_rgba(15,181,174,0.4)]">2</span>
              <span className="text-[12.5px] font-semibold text-[#7BE8E3]">You are here</span>
            </div>
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/16 bg-white/8 font-display text-xs font-bold text-white/70">1</span>
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/16 bg-white/8 font-display text-xs font-bold text-white/70">G</span>
          </div>
        </div>
      </section>

      {/* ── CTA band ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-[#EFF5FB] px-6 py-24 text-center">
        <h2 className="font-display text-[32px] font-bold leading-[1.12] -tracking-[0.5px] text-wf-ink sm:text-[38px] lg:text-[42px] lg:leading-[1.1] lg:-tracking-[1px]">
          Put your hospital on the map
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-wf-muted">
          Walk it with your phone or upload a floor plan — Wayfinder does the rest. Fewer missed
          appointments, fewer stopped-in-the-corridor directions, calmer arrivals.
        </p>
        <div className="mx-auto mt-8 flex max-w-xs flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/map"
            className="rounded-2xl bg-wf-primary px-7 py-4 text-center text-sm font-semibold text-white shadow-[0_10px_24px_rgba(10,93,194,0.3)] transition-transform active:scale-95"
          >
            Map your hospital
          </Link>
          <Link
            href="/navigate"
            className="rounded-2xl border border-wf-border px-7 py-4 text-center text-sm font-semibold text-wf-ink transition-colors hover:border-wf-primary"
          >
            Explore Great Ormond Street
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="flex flex-col items-center justify-between gap-4 border-t border-[#E8EDF4] px-6 py-7 sm:flex-row sm:px-10 lg:px-16 xl:px-24">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-wf-primary to-wf-teal">
            <Navigation size={12} className="text-white" />
          </span>
          <span className="font-display text-sm font-bold text-wf-ink">Wayfinder</span>
        </div>
        <div className="flex items-center gap-6 text-[13.5px] text-wf-muted">
          <span>Privacy</span>
          <span>Accessibility</span>
          <span>Status</span>
          <span>© 2026 Wayfinder</span>
        </div>
      </footer>
    </main>
  )
}

// Stylised dark map background for the hero: a street grid, a glowing route
// (soft underglow + solid line + marching dashes), a pulsing position dot and
// a bobbing destination pin. Reuses the same `wf-*` motion classes/keyframes
// as the live map, so hero and app share one set of animations.
function HeroMap() {
  // The route steps up and across the street grid in right-angled legs with
  // rounded corners — a real turn-by-turn line, not a freehand curve — from the
  // position dot at (240,680) to just under the destination pin near (1000,270).
  const routePath =
    "M240 680 L240 516 Q240 490 266 490 L634 490 Q660 490 660 464 L660 316 Q660 290 686 290 L1004 290"
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 1440 780" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width="1440" height="780" fill="#0A1626" />
        <rect x="80" y="120" width="220" height="140" fill="#0F2138" stroke="#1B3252" />
        <rect x="340" y="90" width="160" height="220" fill="#0D2A33" stroke="#155263" />
        <rect x="120" y="320" width="180" height="160" fill="#0F2138" stroke="#1B3252" />
        <rect x="360" y="360" width="240" height="120" fill="#0D2A33" stroke="#155263" />
        <rect x="640" y="140" width="200" height="180" fill="#0F2138" stroke="#1B3252" />
        <rect x="880" y="80" width="180" height="260" fill="#0D2A33" stroke="#155263" />
        <rect x="660" y="380" width="260" height="140" fill="#0F2138" stroke="#1B3252" />
        <rect x="960" y="400" width="220" height="160" fill="#0D2A33" stroke="#155263" />
        <rect x="1240" y="0" width="200" height="780" fill="#0C1928" />
        <path d={routePath} stroke="#22C9FF" strokeWidth="14" opacity="0.16" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={routePath} stroke="#22C9FF" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={routePath}
          stroke="#B7ECFF"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 24"
          className="wf-route-flow"
        />
      </svg>
      {/*
        The SVG's viewBox height (780) always matches the hero's fixed height,
        so preserveAspectRatio="slice" never actually rescales it — it only
        crops left/right edges, centred, when the container is narrower than
        the 1440 design width. So these overlays track the artwork by offsetting
        from the horizontal centre by the same design-pixel delta, rather than
        a naive percentage (which would drift once the SVG starts cropping).
      */}
      <div className="absolute" style={{ left: "calc(50% - 480px)", top: 680, width: 40, height: 40 }}>
        <div className="wf-locate-ring absolute inset-0 rounded-full" style={{ background: "rgba(34,201,255,0.4)" }} />
        <div
          className="wf-locate-core absolute left-[10px] top-[10px] h-5 w-5 rounded-full border-[3px] border-white"
          style={{ background: "#22C9FF", boxShadow: "0 0 18px rgba(34,201,255,0.9)" }}
        />
      </div>
      <div className="wf-dest-pin absolute" style={{ left: "calc(50% + 272px)", top: 250 }}>
        <div
          className="h-[34px] w-[34px] rounded-full border-[3px] border-white"
          style={{ background: "#0FB5AE", borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)" }}
        />
      </div>
    </div>
  )
}
