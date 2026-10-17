// Where to get the apps, for the website's pages and structured data. The App
// Store link is set once Apple has approved the app (its id is in App Store
// Connect, under App Information): until then the pages offer the web and
// Google Play, and say so.
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ai.findway.app"
export const APP_STORE_URL: string | null = null

// Where Findway runs, for a sentence: "free on the web and Android".
export function appAvailability(appStore: string | null = APP_STORE_URL): string {
  return appStore ? "on the web, iPhone and Android" : "on the web and Android"
}
