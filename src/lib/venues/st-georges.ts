import { Venue } from "../types"

// St George's Hospital, Tooting — one of the largest NHS hospitals in the UK
// (St George's University Hospitals NHS Foundation Trust), on Blackshaw Road,
// London SW17 0QT. Added from a shared Google Maps pin.
//
// It ships as a seed venue alongside GOSH, but only with the points we can place
// from real-world data: the site centre and its confirmed main entrance. We
// deliberately do NOT invent interior floor plans or ward coordinates for a real
// hospital people navigate — those get added the same way GOSH's were, by
// surveying the building in-app.

export const ST_GEORGES_VENUE: Venue = {
  id: "st-georges",
  slug: "st-georges",
  name: "St George's Wayfinder",
  subtitle: "St George's Hospital, Tooting",
  category: "hospital",
  // Blackshaw Road, Tooting, London SW17 0QT — Google's pin for the site.
  center: { lat: 51.4265363, lng: -0.1732006 },
  defaultZoom: 17,
  visibility: "public",
  verified: true,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    notes: "Large multi-building site. Step-free access and Blue Badge parking available; interior routes to be surveyed.",
  },
  quickAccess: ["Main Entrance", "Emergency Department (A&E)"],
  floorPlans: [],
  waypoints: [
    {
      id: "main-entrance",
      name: "Main Entrance",
      type: "reception",
      coordinates: { lat: 51.426332, lng: -0.17277 },
      floor: 0,
      description: "St George's Hospital main entrance, off Blackshaw Road",
    },
    {
      id: "ae-entrance",
      name: "Emergency Department (A&E)",
      type: "exit",
      coordinates: { lat: 51.425148, lng: -0.174911 },
      floor: 0,
      description: "Accident & Emergency entrance",
    },
  ],
}
