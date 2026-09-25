"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Route } from "./types"

// Turn-by-turn guidance you can hear and feel, not just read.
//
// A navigation app is used with the phone half-lowered and eyes on the
// corridor, and for someone with low vision the map is no use at all. So when
// the current step changes while navigating, the instruction is (a) written to
// a polite live region for screen readers, always; (b) spoken aloud through the
// Web Speech API, when the walker has turned that on; and (c) accompanied by a
// short vibration where the device supports it. Nothing here blocks or
// interrupts navigation; every capability is feature-detected and optional.
//
// The spoken-directions preference is remembered on the device.

const SPOKEN_KEY = "wayfinder.spokenDirections"

function readSpokenPreference(): boolean {
  try {
    return window.localStorage.getItem(SPOKEN_KEY) === "true"
  } catch {
    return false
  }
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-GB"
    u.rate = 1
    synth.speak(u)
  } catch {
    // A browser that lists the API but refuses to use it (no voices, autoplay
    // rules) simply stays silent.
  }
}

function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern)
  } catch {}
}

interface Params {
  active: boolean
  route: Route | null
  stepIndex: number
}

export function useGuidanceAnnouncer({ active, route, stepIndex }: Params) {
  const [spoken, setSpoken] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  // What the live region currently says. Set only on a genuine step change so
  // assistive tech does not re-read the same instruction on every re-render.
  const [announcement, setAnnouncement] = useState("")
  const lastKeyRef = useRef<string | null>(null)
  const spokenRef = useRef(false)

  useEffect(() => {
    // Both are browser facts unknown during server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window)
    const pref = readSpokenPreference()
    spokenRef.current = pref
    setSpoken(pref)
  }, [])

  const setSpokenDirections = useCallback((on: boolean) => {
    spokenRef.current = on
    setSpoken(on)
    try {
      window.localStorage.setItem(SPOKEN_KEY, String(on))
    } catch {}
    if (on) speak("Spoken directions on.")
    else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    if (!active || !route) {
      lastKeyRef.current = null
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
      return
    }
    const step = route.steps[stepIndex]
    if (!step) return
    // Keyed on the route's own identity so a re-route announces its new first
    // step even when the index is 0 both times.
    const key = `${route.steps.length}:${route.totalDistance}:${stepIndex}:${step.instruction}`
    if (lastKeyRef.current === key) return
    const isFirst = lastKeyRef.current === null
    lastKeyRef.current = key

    const arrived = /arrived/i.test(step.instruction)
    const distance = step.distance > 0 ? `, ${Math.round(step.distance)} metres` : ""
    const text = `${step.instruction}${distance}`
    // Announcing is a reaction to the walker reaching a step, not derived state.
    setAnnouncement(text)
    if (spokenRef.current) speak(text)
    // The first step buzzes as a "guidance started" cue; arrival is a longer
    // double buzz; every turn in between a short one.
    buzz(arrived ? [120, 80, 160] : isFirst ? 60 : 40)
  }, [active, route, stepIndex])

  return { announcement, spoken, speechSupported, setSpokenDirections }
}
