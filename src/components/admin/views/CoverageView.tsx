"use client"
import CoverageBrowser from "@/components/CoverageBrowser"
import { PageHeader } from "../ui"

export default function CoverageView() {
  return (
    <>
      <PageHeader
        title="Coverage"
        description="Every country with hospitals listed, every hospital whose grounds are mapped well enough for a site map, and every hospital mapped inside. Pick a country, then open any map in the app."
      />
      <div className="rounded-2xl border border-wf-border bg-white p-5">
        <CoverageBrowser />
      </div>
    </>
  )
}
