"use client"

import { useState, useEffect, useRef } from "react"

interface Venue {
  id: number
  name: string
  floors?: number
  address?: string
}

interface FloorPlanRecord {
  id: number
  floor: number
  label: string
  image_url?: string
}

interface FloorUploadState {
  status: "idle" | "uploading" | "done" | "error"
  message?: string
}

export default function AdminPage() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [floorPlans, setFloorPlans] = useState<FloorPlanRecord[]>([])
  const [uploadStates, setUploadStates] = useState<Record<number, FloorUploadState>>({})
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch("/api/venues")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVenues(data)
      })
      .catch(() => {})
  }, [])

  function loadFloorPlans(venue: Venue) {
    setSelectedVenue(venue)
    setFloorPlans([])
    setUploadStates({})
    fetch(`/api/venues/${venue.id}/floor-plans`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFloorPlans(data) })
      .catch(() => {})
  }

  function floorCount(venue: Venue): number {
    return Math.max(venue.floors ?? 1, 1)
  }

  function existingPlan(floor: number): FloorPlanRecord | undefined {
    return floorPlans.find((p) => p.floor === floor)
  }

  async function handleFileUpload(floor: number, file: File) {
    if (!selectedVenue) return
    setUploadStates((s) => ({ ...s, [floor]: { status: "uploading" } }))

    const reader = new FileReader()
    reader.onload = async () => {
      const image_data = reader.result as string // base64 data URL
      try {
        const res = await fetch(`/api/venues/${selectedVenue.id}/floor-plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            floor,
            label: `Floor ${floor === 0 ? "G" : floor}`,
            image_data,
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        const record = await res.json()
        setFloorPlans((prev) => {
          const next = prev.filter((p) => p.floor !== floor)
          return [...next, record]
        })
        setUploadStates((s) => ({ ...s, [floor]: { status: "done", message: "Uploaded" } }))
      } catch (e) {
        setUploadStates((s) => ({
          ...s,
          [floor]: { status: "error", message: String(e) },
        }))
      }
    }
    reader.readAsDataURL(file)
  }

  const floors = selectedVenue
    ? Array.from({ length: floorCount(selectedVenue) }, (_, i) => i)
    : []

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Floor Plan Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Upload floor plan images per venue and floor.</p>
        </div>

        {/* Venue list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">Select a venue</h2>
          </div>
          {venues.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No venues found</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {venues.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => loadFloorPlans(v)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      selectedVenue?.id === v.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{v.name}</p>
                      {v.address && <p className="text-xs text-gray-400">{v.address}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{floorCount(v)} floor{floorCount(v) !== 1 ? "s" : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Floor plan uploads */}
        {selectedVenue && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700 text-sm">
                Floor plans — {selectedVenue.name}
              </h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {floors.map((floor) => {
                const plan = existingPlan(floor)
                const state = uploadStates[floor]
                return (
                  <li key={floor} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 text-sm">
                        {floor === 0 ? "Ground Floor" : `Floor ${floor}`}
                      </p>
                      {plan?.image_url && (
                        <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                          Image stored
                        </span>
                      )}
                    </div>

                    {plan?.image_url && (
                      <div className="mb-3">
                        <img
                          src={plan.image_url}
                          alt={`Floor ${floor} plan`}
                          className="h-24 w-auto rounded-lg border border-gray-200 object-contain"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <input
                        ref={(el) => { fileInputRefs.current[floor] = el }}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(floor, file)
                        }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[floor]?.click()}
                        disabled={state?.status === "uploading"}
                        className="text-sm bg-[#005EB8] text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
                      >
                        {state?.status === "uploading"
                          ? "Uploading…"
                          : plan?.image_url
                          ? "Replace image"
                          : "Upload image"}
                      </button>
                      {state?.status === "done" && (
                        <span className="text-xs text-green-600 font-medium">Saved</span>
                      )}
                      {state?.status === "error" && (
                        <span className="text-xs text-red-600 font-medium truncate max-w-[200px]">
                          {state.message}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
