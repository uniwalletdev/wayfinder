export interface LogEntry {
  t: number
  level: "info" | "warn" | "error"
  msg: string
}

const MAX = 100
let buffer: LogEntry[] = []
const subscribers = new Set<(entries: LogEntry[]) => void>()

export function log(level: LogEntry["level"], msg: string) {
  buffer = [...buffer, { t: Date.now(), level, msg }].slice(-MAX)
  subscribers.forEach((fn) => fn(buffer))
}

export const logInfo = (m: string) => log("info", m)
export const logWarn = (m: string) => log("warn", m)
export const logError = (m: string) => log("error", m)

export function getLogs(): LogEntry[] {
  return buffer
}

export function subscribeLogs(fn: (entries: LogEntry[]) => void): () => void {
  subscribers.add(fn)
  fn(buffer)
  return () => subscribers.delete(fn)
}

export function clearLogs() {
  buffer = []
  subscribers.forEach((fn) => fn(buffer))
}
