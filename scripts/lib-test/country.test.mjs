// Checks how the app decides which country's hospitals to show
// (src/lib/country.ts): the time-zone table, locale regions and country-name
// search.
//
// Run: node scripts/lib-test/country.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { countryFromTimeZone, countryFromLocale, countryName, matchCountries, isCountryCode, HOME_COUNTRY, detectCountry } =
  await import(fileURLToPath(new URL("country.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("a time zone names its country")
{
  check("London is the UK", countryFromTimeZone("Europe/London") === "GB")
  check("Luxembourg is Luxembourg", countryFromTimeZone("Europe/Luxembourg") === "LU")
  check("a zone shared since the 2022 merges goes to the country it is named for", countryFromTimeZone("Europe/Brussels") === "BE" && countryFromTimeZone("Europe/Berlin") === "DE")
  check("the merged-away zones still resolve", countryFromTimeZone("Europe/Copenhagen") === "DK" && countryFromTimeZone("Europe/Amsterdam") === "NL")
  check("every US zone is the US", ["America/New_York", "America/Los_Angeles", "America/Chicago", "Pacific/Honolulu"].every((z) => countryFromTimeZone(z) === "US"))
  check("legacy spellings older phones report", countryFromTimeZone("Asia/Calcutta") === "IN" && countryFromTimeZone("Europe/Kiev") === "UA")
  check("case does not matter", countryFromTimeZone("europe/london") === "GB")
  check("an offset zone says nothing", countryFromTimeZone("Etc/GMT+1") === null && countryFromTimeZone("UTC") === null)
  check("nothing is nothing", countryFromTimeZone(undefined) === null && countryFromTimeZone("") === null)
}

group("a locale's region")
{
  check("fr-LU is Luxembourg", countryFromLocale("fr-LU") === "LU")
  check("en-GB is the UK", countryFromLocale("en-GB") === "GB")
  check("a script subtag is skipped", countryFromLocale("zh-Hant-TW") === "TW")
  check("a bare language is not a place", countryFromLocale("fr") === null && countryFromLocale("en") === null)
  check("a numeric region is not a country", countryFromLocale("es-419") === null)
}

group("names and search")
{
  check("home is the UK", HOME_COUNTRY === "GB" && isCountryCode("GB"))
  check("codes are named in English", countryName("LU") === "Luxembourg" && countryName("GB") === "United Kingdom")
  check("typing a country finds it", matchCountries("luxem")[0] === "LU")
  check("a word inside the name counts", matchCountries("kingdom").includes("GB"))
  check("a short query finds nothing", matchCountries("l").length === 0)
  check("the list is capped", matchCountries("s").length === 0 && matchCountries("sa", 3).length <= 3)
  check("made-up codes are refused", !isCountryCode("ZZ") && !isCountryCode("gb"))
  check("on the server the country is home", detectCountry() === "GB")
}

report()
