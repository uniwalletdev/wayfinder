// Where to get the apps, for the website's pages and structured data. The App
// Store id is Findway Map's Apple ID in App Store Connect (App Information).
// A link without a country opens each visitor's own App Store.
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ai.findway.app"
export const APP_STORE_ID = "6818029311"
export const APP_STORE_URL: string | null = `https://apps.apple.com/app/id${APP_STORE_ID}`

// Where Findway runs, for a sentence: "free on the web, iPhone and Android".
export function appAvailability(appStore: string | null = APP_STORE_URL): string {
  return appStore ? "on the web, iPhone and Android" : "on the web and Android"
}
