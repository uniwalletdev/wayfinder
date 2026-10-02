"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Route } from "./types"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics"
import { speak, speechAvailable, spokenStep, stopSpeaking } from "./voice"

// Turn-by-turn guidance you can hear and feel, not just read.
//
// A navigation app is used with the phone half-lowered and eyes on the
// corridor, and for someone with low vision the map is no use at all. So when
// the current step changes while navigating, the instruction is (a) written to
// a polite live region for screen readers, always; (b) spoken aloud in a calm
// voice (src/lib/voice.ts), when the walker has turned that on; and (c) accompanied by a
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

// iPhones have no Vibration API, in Safari or in the apps' web view, so the
// turn cue used to vanish there. Inside the apps it goes through the system
// haptics engine: one tap for a step, the two-pulse "warning" for arrival. The
// web keeps navigator.vibrate where the browser has it.
function buzz(pattern: number | number[]) {
  try {
    if (Capacitor.isNativePlatform()) {
      const pulses = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1
      void (pulses > 1 ? Haptics.notification({ type: NotificationType.Warning }) : Haptics.impact({ style: ImpactStyle.Medium })).catch(() => {})
      return
    }
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
    setSpeechSupported(speechAvailable())
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
    if (on) void speak("Spoken directions are on. I'll guide you, step by step.")
    else stopSpeaking()
  }, [])

  useEffect(() => {
    if (!active || !route) {
      lastKeyRef.current = null
      stopSpeaking()
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
    if (spokenRef.current) void speak(spokenStep(step.instruction, step.distance, { first: isFirst }))
    // The first step buzzes as a "guidance started" cue; arrival is a longer
    // double buzz; every turn in between a short one.
    buzz(arrived ? [120, 80, 160] : isFirst ? 60 : 40)
  }, [active, route, stepIndex])

  return { announcement, spoken, speechSupported, setSpokenDirections }
}
