// AUTO-GENERATED from the GOSH directory spreadsheet + the official site map.
// Source files: scripts/data/gosh-wards-and-departments.xlsx and gosh-site-map.pdf.
// Regenerate via: python3 scripts/import-gosh.py — do not hand-edit.
import { Site, Building, MapLocation } from "../types"

export const GOSH_SITE: Site = {"id": "gosh", "name": "Great Ormond Street Hospital", "shortName": "GOSH", "description": "NHS children’s hospital, Bloomsbury, London", "center": {"lat": 51.5224, "lng": -0.1203}, "defaultZoom": 18, "brandColor": "#005EB8", "map": {"imageUrl": "/map/gosh-site.png", "corners": {"topLeft": [51.521258, -0.121826], "topRight": [51.522915, -0.122539], "bottomLeft": [51.521885, -0.118061]}, "bounds": [[51.521258, -0.122539], [51.523542, -0.118061]]}}

export const GOSH_BUILDINGS: Building[] = [
  {
    "id": "40-bernard-street",
    "name": "40 Bernard Street",
    "fullName": "40 Bernard Street",
    "aliases": [],
    "coordinates": {
      "lat": 51.521366,
      "lng": -0.121711
    },
    "precise": false
  },
  {
    "id": "45-great-ormond-street",
    "name": "45 Great Ormond Street",
    "fullName": "45 Great Ormond Street",
    "aliases": [],
    "coordinates": {
      "lat": 51.521795,
      "lng": -0.119878
    },
    "precise": false
  },
  {
    "id": "51-great-ormond-street",
    "name": "51 Great Ormond Street",
    "fullName": "51 Great Ormond Street",
    "aliases": [],
    "coordinates": {
      "lat": 51.521833,
      "lng": -0.119652
    },
    "precise": false
  },
  {
    "id": "55-great-ormond-street",
    "name": "55 Great Ormond Street",
    "fullName": "55 Great Ormond Street",
    "aliases": [],
    "coordinates": {
      "lat": 51.521745,
      "lng": -0.120179
    },
    "precise": false
  },
  {
    "id": "barclay-house",
    "name": "Barclay House",
    "fullName": "Barclay (formerly York) House",
    "aliases": [
      "York House"
    ],
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    },
    "precise": true
  },
  {
    "id": "boiler-house",
    "name": "Boiler House",
    "fullName": "Boiler House",
    "aliases": [],
    "coordinates": {
      "lat": 51.522127,
      "lng": -0.119698
    },
    "precise": false
  },
  {
    "id": "camelia-botnar-laboratories",
    "name": "Camelia Botnar Laboratories",
    "fullName": "Camelia Botnar Laboratories",
    "aliases": [],
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    },
    "precise": true
  },
  {
    "id": "cardiac-wing",
    "name": "Cardiac Wing",
    "fullName": "Cardiac Wing",
    "aliases": [],
    "coordinates": {
      "lat": 51.522475,
      "lng": -0.119848
    },
    "precise": false
  },
  {
    "id": "frontage-building",
    "name": "Frontage Building",
    "fullName": "Frontage Building",
    "aliases": [],
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    },
    "precise": false
  },
  {
    "id": "italian-building",
    "name": "Italian Building",
    "fullName": "Italian Building",
    "aliases": [],
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    },
    "precise": false
  },
  {
    "id": "morgan-stanley-clinical-building",
    "name": "Morgan Stanley Clinical Building",
    "fullName": "Morgan Stanley Clinical Building — Mittal Children's Medical Centre",
    "aliases": [
      "Mittal Children's Medical Centre",
      "Morgan Stanley",
      "Mittal",
      "MSCB"
    ],
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    },
    "precise": true
  },
  {
    "id": "nurses-home",
    "name": "Nurses Home",
    "fullName": "Nurses Home",
    "aliases": [],
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    },
    "precise": true
  },
  {
    "id": "nurses-home-porta-cabins",
    "name": "Nurses Home Porta Cabins",
    "fullName": "Nurses Home Porta Cabins",
    "aliases": [],
    "coordinates": {
      "lat": 51.523046,
      "lng": -0.120901
    },
    "precise": false
  },
  {
    "id": "octav-botnar-wing",
    "name": "Octav Botnar Wing",
    "fullName": "Octav Botnar Wing",
    "aliases": [
      "OBW"
    ],
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    },
    "precise": true
  },
  {
    "id": "orangery",
    "name": "Orangery",
    "fullName": "Orangery",
    "aliases": [],
    "coordinates": {
      "lat": 51.522609,
      "lng": -0.120753
    },
    "precise": false
  },
  {
    "id": "ormond-house",
    "name": "Ormond House",
    "fullName": "Ormond House",
    "aliases": [],
    "coordinates": {
      "lat": 51.521695,
      "lng": -0.120481
    },
    "precise": false
  },
  {
    "id": "paul-ogorman-building",
    "name": "Paul O'Gorman Building",
    "fullName": "Paul O'Gorman Building",
    "aliases": [],
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    },
    "precise": false
  },
  {
    "id": "southwood-building",
    "name": "Southwood Building",
    "fullName": "Southwood Building",
    "aliases": [],
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    },
    "precise": true
  },
  {
    "id": "southwood-courtyard",
    "name": "Southwood Courtyard",
    "fullName": "Southwood Courtyard",
    "aliases": [],
    "coordinates": {
      "lat": 51.522841,
      "lng": -0.120853
    },
    "precise": false
  },
  {
    "id": "the-royal-london-hospital-for-integrated-medicine",
    "name": "The Royal London Hospital for Integrated Medicine",
    "fullName": "The Royal London Hospital for Integrated Medicine",
    "aliases": [
      "RLHIM",
      "Maple, Rabbit & Zebra Outpatients"
    ],
    "coordinates": {
      "lat": 51.522048,
      "lng": -0.121238
    },
    "precise": true
  },
  {
    "id": "variety-club-building",
    "name": "Variety Club Building",
    "fullName": "Variety Club Building",
    "aliases": [
      "VCB"
    ],
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    },
    "precise": true
  },
  {
    "id": "west-link",
    "name": "West Link",
    "fullName": "West Link",
    "aliases": [],
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    },
    "precise": false
  },
  {
    "id": "weston-house",
    "name": "Weston House",
    "fullName": "Weston House",
    "aliases": [],
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    },
    "precise": true
  }
]

export const GOSH_LOCATIONS: MapLocation[] = [
  {
    "id": "great-ormond-street-hospital-childrens-c-40-bernard-street-4",
    "name": "Great Ormond Street Hospital Children's Charity (GOSHCC)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "40-bernard-street",
    "building": "40 Bernard Street",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521366,
      "lng": -0.121711
    }
  },
  {
    "id": "great-ormond-street-hospital-childrens-c-45-great-ormond-street-ground-floor-and-basement",
    "name": "Great Ormond Street Hospital Children's Charity (GOSHCC)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "45-great-ormond-street",
    "building": "45 Great Ormond Street",
    "floor": 0,
    "floorLabel": "Ground & Basement",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521795,
      "lng": -0.119878
    }
  },
  {
    "id": "children-with-cancer-uk-51-great-ormond-street-ground-floor",
    "name": "Children with CANCER UK",
    "type": "office",
    "icon": "🏢",
    "buildingId": "51-great-ormond-street",
    "building": "51 Great Ormond Street",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521833,
      "lng": -0.119652
    }
  },
  {
    "id": "gos-patient-experience-team-55-great-ormond-street-1st-floor",
    "name": "GOS Patient Experience Team",
    "type": "office",
    "icon": "🏢",
    "buildingId": "55-great-ormond-street",
    "building": "55 Great Ormond Street",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521745,
      "lng": -0.120179
    }
  },
  {
    "id": "general-paediatric-55-great-ormond-street-2nd-floor",
    "name": "General Paediatric",
    "type": "office",
    "icon": "🏢",
    "buildingId": "55-great-ormond-street",
    "building": "55 Great Ormond Street",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521745,
      "lng": -0.120179
    }
  },
  {
    "id": "league-of-remembrance-55-great-ormond-street-ground-floor",
    "name": "League of Remembrance",
    "type": "office",
    "icon": "🏢",
    "buildingId": "55-great-ormond-street",
    "building": "55 Great Ormond Street",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521745,
      "lng": -0.120179
    }
  },
  {
    "id": "archives-barclay-house-1",
    "name": "Archives",
    "type": "storage",
    "icon": "📦",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "edm-project-team-barclay-house-1",
    "name": "EDM Project Team",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "haemonc-offices-barclay-house-1",
    "name": "HaemOnc Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "hospital-archive-barclay-house-1",
    "name": "Hospital Archive",
    "type": "storage",
    "icon": "📦",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "ict-department-barclay-house-1",
    "name": "ICT Department",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "regional-genetics-store-barclay-house-1",
    "name": "Regional Genetics Store",
    "type": "storage",
    "icon": "📦",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "archivist-office-barclay-house-2",
    "name": "Archivist Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "assistant-directors-of-nursing-barclay-house-2",
    "name": "Assistant Directors of Nursing",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "bereavement-services-barclay-house-2",
    "name": "Bereavement Services",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "child-death-helpline-barclay-house-2",
    "name": "Child Death Helpline",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "human-resources-barclay-house-2",
    "name": "Human Resources",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "meeting-rooms-barclay-house-2",
    "name": "Meeting Rooms",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "nursing-administration-barclay-house-2",
    "name": "Nursing Administration",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "workforce-planning-and-information-barclay-house-2",
    "name": "Workforce Planning and Information",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "facilities-department-barclay-house-3",
    "name": "Facilities Department",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "finance-accounts-payable-and-receivable-barclay-house-3",
    "name": "Finance: Accounts Payable and Receivable",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "finance-costings-barclay-house-3",
    "name": "Finance: Costings",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "finance-financial-accounts-barclay-house-3",
    "name": "Finance: Financial Accounts",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "finance-financial-management-barclay-house-3",
    "name": "Finance: Financial Management",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "finance-payroll-barclay-house-3",
    "name": "Finance: Payroll",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "information-services-barclay-house-3",
    "name": "Information Services",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "staff-accommodation-services-barclay-house-4",
    "name": "(Staff) Accommodation Services",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "centre-for-outcomes-and-experience-resea-barclay-house-4",
    "name": "Centre for Outcomes and Experience Research in Children's Health, Illness and Disability (ORCHID)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "clinical-genetics-barclay-house-4",
    "name": "Clinical Genetics",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "estates-department-barclay-house-4",
    "name": "Estates Department",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "meeting-rooms-barclay-house-4",
    "name": "Meeting Rooms",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "redevelopment-department-inc-project-ser-barclay-house-4",
    "name": "Redevelopment Department (inc Project Services)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "regional-cytogenetic-laboratory-barclay-house-5",
    "name": "Regional Cytogenetic Laboratory",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "regional-molecular-genetics-laboratory-barclay-house-6",
    "name": "Regional Molecular Genetics Laboratory",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "barclay-house",
    "building": "Barclay House",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521673,
      "lng": -0.121359
    }
  },
  {
    "id": "scanning-bureau-boiler-house-1",
    "name": "Scanning Bureau",
    "type": "office",
    "icon": "🏢",
    "buildingId": "boiler-house",
    "building": "Boiler House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522127,
      "lng": -0.119698
    }
  },
  {
    "id": "works-storage-boiler-house-1",
    "name": "Works Storage",
    "type": "storage",
    "icon": "📦",
    "buildingId": "boiler-house",
    "building": "Boiler House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522127,
      "lng": -0.119698
    }
  },
  {
    "id": "vent-tech-boiler-house-1",
    "name": "Vent Tech",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "boiler-house",
    "building": "Boiler House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522127,
      "lng": -0.119698
    }
  },
  {
    "id": "storage-facilties-and-redevelopment-boiler-house-2",
    "name": "Storage (Facilties and Redevelopment)",
    "type": "storage",
    "icon": "📦",
    "buildingId": "boiler-house",
    "building": "Boiler House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522127,
      "lng": -0.119698
    }
  },
  {
    "id": "works-storage-boiler-house-2",
    "name": "Works Storage",
    "type": "storage",
    "icon": "📦",
    "buildingId": "boiler-house",
    "building": "Boiler House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522127,
      "lng": -0.119698
    }
  },
  {
    "id": "cbl-stores-camelia-botnar-laboratories-0",
    "name": "CBL Stores",
    "type": "storage",
    "icon": "📦",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "mortuary-camelia-botnar-laboratories-0",
    "name": "Mortuary",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "blood-sciences-laboratory-camelia-botnar-laboratories-1",
    "name": "Blood Sciences Laboratory",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "blood-transfusion-camelia-botnar-laboratories-1",
    "name": "Blood Transfusion",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "specimen-reception-camelia-botnar-laboratories-1",
    "name": "Specimen Reception",
    "type": "clinical-support",
    "icon": "💁",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "bone-marrow-laboratory-camelia-botnar-laboratories-2",
    "name": "Bone Marrow Laboratory",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "ich-molecular-haematology-and-cancer-bio-camelia-botnar-laboratories-2",
    "name": "ICH Molecular Haematology & Cancer Biology Unit",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "pmcu-camelia-botnar-laboratories-2",
    "name": "PMCU",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "specialist-coagulation-camelia-botnar-laboratories-2",
    "name": "Specialist Coagulation",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "histopathology-camelia-botnar-laboratories-3",
    "name": "Histopathology",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "immunology-camelia-botnar-laboratories-4",
    "name": "Immunology",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "infection-control-camelia-botnar-laboratories-4",
    "name": "Infection control",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "microbiology-camelia-botnar-laboratories-4",
    "name": "Microbiology",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "virology-camelia-botnar-laboratories-4",
    "name": "Virology",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "chemical-pathology-camelia-botnar-laboratories-5",
    "name": "Chemical Pathology",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "regional-new-born-screening-camelia-botnar-laboratories-5",
    "name": "Regional New Born Screening",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "camelia-botnar-laboratories",
    "building": "Camelia Botnar Laboratories",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522627,
      "lng": -0.11947
    }
  },
  {
    "id": "bod-pod-cardiac-wing-1",
    "name": "Bod Pod",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "cardiac-wing",
    "building": "Cardiac Wing",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522475,
      "lng": -0.119848
    }
  },
  {
    "id": "mri-cardiac-wing-1",
    "name": "MRI",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "cardiac-wing",
    "building": "Cardiac Wing",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522475,
      "lng": -0.119848
    }
  },
  {
    "id": "nuclear-medicine-cardiac-wing-1",
    "name": "Nuclear Medicine",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "cardiac-wing",
    "building": "Cardiac Wing",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522475,
      "lng": -0.119848
    }
  },
  {
    "id": "djanogly-outpatients-frontage-building-1",
    "name": "Djanogly Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "somers-clinical-research-facility-crf-frontage-building-1",
    "name": "Somers Clinical Research Facility (CRF)",
    "type": "teaching-research",
    "icon": "📚",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "wooden-spoon-room-frontage-building-1",
    "name": "Wooden Spoon Room",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "manta-ray-outpatients-frontage-building-1",
    "name": "Manta Ray Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "audiology-frontage-building-2",
    "name": "Audiology",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "cochlear-implant-frontage-building-2",
    "name": "Cochlear Implant",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "rhino-outpatients-frontage-building-2",
    "name": "Rhino Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "medical-records-frontage-building-3",
    "name": "Medical Records",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "panda-day-care-frontage-building-3",
    "name": "Panda Day Care",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "skanska-offices-frontage-building-3",
    "name": "Skanska offices",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "clinical-neuropyschology-frontage-building-4",
    "name": "Clinical Neuropyschology",
    "type": "office",
    "icon": "🏢",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "dept-of-child-and-adolescent-mental-heal-frontage-building-4",
    "name": "Dept. of Child and Adolescent Mental Health (CAMHS)",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "paediatric-psychology-frontage-building-4",
    "name": "Paediatric Psychology",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "cardio-respiratory-physiotherapy-frontage-building-5",
    "name": "Cardio-Respiratory Physiotherapy",
    "type": "office",
    "icon": "🏢",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "mildred-creak-unit-frontage-building-5",
    "name": "Mildred Creak Unit",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "occupational-therapy-frontage-building-5",
    "name": "Occupational Therapy",
    "type": "office",
    "icon": "🏢",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "physiotherapy-frontage-building-5",
    "name": "Physiotherapy",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "play-services-frontage-building-5",
    "name": "Play Services",
    "type": "office",
    "icon": "🏢",
    "buildingId": "frontage-building",
    "building": "Frontage Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522072,
      "lng": -0.120562
    }
  },
  {
    "id": "rainbow-lagoon-staff-nursery-italian-building-1",
    "name": "Rainbow Lagoon Staff Nursery",
    "type": "non-clinical-support",
    "icon": "🍽️",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "volunteers-services-italian-building-1",
    "name": "Volunteers Services",
    "type": "office",
    "icon": "🏢",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "psychosocial-offices-italian-building-2",
    "name": "Psychosocial Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "rainbow-lagoon-staff-nursery-italian-building-2",
    "name": "Rainbow Lagoon Staff Nursery",
    "type": "non-clinical-support",
    "icon": "🍽️",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "family-support-offices-italian-building-3",
    "name": "Family Support Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "psychosocial-services-offices-italian-building-3",
    "name": "Psychosocial Services Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "transplant-flats-italian-building-3",
    "name": "Transplant Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "parent-accommodation-italian-building-4",
    "name": "Parent Accommodation",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "transplant-flats-italian-building-4",
    "name": "Transplant Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "chapel-italian-building-5",
    "name": "Chapel",
    "type": "non-clinical-support",
    "icon": "⛪",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "parent-accommodation-italian-building-5",
    "name": "Parent Accommodation",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "italian-building",
    "building": "Italian Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52229,
      "lng": -0.120535
    }
  },
  {
    "id": "assisted-staff-change-morgan-stanley-clinical-building-0",
    "name": "Assisted Staff Change",
    "type": "changing",
    "icon": "🚿",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "catering-staff-change-male-female-morgan-stanley-clinical-building-0",
    "name": "Catering Staff Change -  Male/Female",
    "type": "changing",
    "icon": "🚿",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "clinical-staff-change-male-female-morgan-stanley-clinical-building-0",
    "name": "Clinical Staff Change -  Male/ Female",
    "type": "changing",
    "icon": "🚿",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "diet-kitchen-morgan-stanley-clinical-building-0",
    "name": "Diet Kitchen",
    "type": "non-clinical-support",
    "icon": "🍽️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "main-kitchen-morgan-stanley-clinical-building-0",
    "name": "Main Kitchen",
    "type": "non-clinical-support",
    "icon": "🍽️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "echo-ecg-morgan-stanley-clinical-building-1",
    "name": "Echo / ECG",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "lung-function-morgan-stanley-clinical-building-1",
    "name": "Lung Function",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "walrus-clinical-investigations-centre-morgan-stanley-clinical-building-1",
    "name": "Walrus Clinical Investigations Centre",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "walrus-day-care-morgan-stanley-clinical-building-1",
    "name": "Walrus Day Care",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "coffee-shop-morgan-stanley-clinical-building-2",
    "name": "Coffee Shop",
    "type": "non-clinical-support",
    "icon": "🛍️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "gosh-charity-desk-morgan-stanley-clinical-building-2",
    "name": "GOSH Charity Desk",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "gosh-shop-morgan-stanley-clinical-building-2",
    "name": "GOSH Shop",
    "type": "non-clinical-support",
    "icon": "🛍️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "the-lagoon-restaurant-morgan-stanley-clinical-building-2",
    "name": "The Lagoon (restaurant)",
    "type": "non-clinical-support",
    "icon": "🍽️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "theatres-7-10-morgan-stanley-clinical-building-3",
    "name": "Theatres 7 - 10",
    "type": "theatres",
    "icon": "🔪",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "flamingo-cardiac-intensive-care-unit-morgan-stanley-clinical-building-4",
    "name": "Flamingo (Cardiac Intensive Care Unit)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "koala-ward-morgan-stanley-clinical-building-5",
    "name": "Koala Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "bear-ward-morgan-stanley-clinical-building-6",
    "name": "Bear Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "eagle-ward-dialysis-unit-inc-haemodialys-morgan-stanley-clinical-building-7",
    "name": "Eagle Ward (Dialysis Unit) inc Haemodialysis",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "morgan-stanley-clinical-building",
    "building": "Morgan Stanley Clinical Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522605,
      "lng": -0.120348
    }
  },
  {
    "id": "works-department-plant-nurses-home-1",
    "name": "Works Department / Plant",
    "type": "workshop",
    "icon": "🛠️",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "portering-receipts-and-distribution-nurses-home-1",
    "name": "Portering, Receipts and Distribution",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "dietetics-offices-nurses-home-2",
    "name": "Dietetics Offices",
    "type": "office",
    "icon": "🍽️",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "doctors-mess-nurses-home-2",
    "name": "Doctor's Mess",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "patient-laundry-nurses-home-2",
    "name": "Patient Laundry",
    "type": "office",
    "icon": "🧺",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "radiology-offices-nurses-home-2",
    "name": "Radiology Offices",
    "type": "office",
    "icon": "🩻",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "speech-and-language-therapy-admin-office-nurses-home-2",
    "name": "Speech and Language Therapy Admin Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "child-protection-office-nurses-home-3",
    "name": "Child Protection Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "clinical-site-practitioners-csp-office-nurses-home-3",
    "name": "Clinical Site Practitioners (CSP) Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "mezzanine-unit-mother-and-baby-unit-nurses-home-3",
    "name": "Mezzanine Unit (Mother and Baby Unit)",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "nursing-and-education-nurses-home-4",
    "name": "Nursing and Education",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "oncology-outreach-and-palliative-care-te-nurses-home-4",
    "name": "Oncology Outreach and Palliative Care Team",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "resuscitation-services-nurses-home-4",
    "name": "Resuscitation Services",
    "type": "teaching-research",
    "icon": "📚",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "clinical-simulation-centre-nurses-home-4",
    "name": "Clinical Simulation Centre",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "moving-and-handling-training-rooms-nurses-home-4",
    "name": "Moving and Handling Training Rooms",
    "type": "teaching-research",
    "icon": "📚",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "nursing-and-education-nurses-home-4-2",
    "name": "Nursing and Education",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "oncology-outreach-and-palliative-care-te-nurses-home-4-2",
    "name": "Oncology Outreach and Palliative Care Team",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "nursing-and-hca-bank-nurses-home-4",
    "name": "Nursing and HCA Bank",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "bmt-offices-nurses-home-5",
    "name": "BMT Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "clinical-coding-nurses-home-5",
    "name": "Clinical Coding",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "rheumatology-offices-nurses-home-5",
    "name": "Rheumatology Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "ent-offices-nurses-home-5",
    "name": "ENT Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "gastroenterology-offices-nurses-home-5",
    "name": "Gastroenterology Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "cardiorespiratory-offices-2-store-rooms-nurses-home-6",
    "name": "Cardiorespiratory Offices (+ 2 Store Rooms)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "cardiorespiratory-offices-nurses-home-6",
    "name": "Cardiorespiratory Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "cardiorespiratory-offices-2-store-rooms-nurses-home-7",
    "name": "Cardiorespiratory Offices (+ 2 Store Rooms)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "cardiorespiratory-offices-nurses-home-7",
    "name": "Cardiorespiratory Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "cardiorespiratory-nephrology-cystic-fibr-nurses-home-8",
    "name": "Cardiorespiratory, Nephrology, Cystic Fibrosis Offices +  1 Store Room",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "paediatric-and-neonatal-intensive-care-o-nurses-home-8",
    "name": "Paediatric and Neonatal Intensive Care Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "cardiorespiratory-nephrology-cystic-fibr-nurses-home-8-2",
    "name": "Cardiorespiratory, Nephrology, Cystic Fibrosis Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "paediatric-and-neonatal-intensive-care-o-nurses-home-8-2",
    "name": "Paediatric and Neonatal Intensive Care Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "neurosciences-offices-nurses-home-9",
    "name": "Neurosciences Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 9,
    "floorLabel": "Level 9",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "neurosciences-offices-nurses-home-9-2",
    "name": "Neurosciences Offices",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 9,
    "floorLabel": "Level 9",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "neurosciences-offices-nurses-home-10",
    "name": "Neurosciences Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 10,
    "floorLabel": "Level 10",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "neurosciences-offices-nurses-home-10-2",
    "name": "Neurosciences Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home",
    "building": "Nurses Home",
    "floor": 10,
    "floorLabel": "Level 10",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522909,
      "lng": -0.121084
    }
  },
  {
    "id": "oncology-outreach-and-palliative-care-te-nurses-home-porta-cabins-4",
    "name": "Oncology Outreach and Palliative Care Team",
    "type": "office",
    "icon": "🏢",
    "buildingId": "nurses-home-porta-cabins",
    "building": "Nurses Home Porta Cabins",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.523046,
      "lng": -0.120901
    }
  },
  {
    "id": "biomedical-engineering-services-octav-botnar-wing-0",
    "name": "Biomedical Engineering Services",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "biomedical-engineering-services-octav-botnar-wing-1",
    "name": "Biomedical Engineering Services",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "theatres-14-15-ocean-theatres-octav-botnar-wing-1",
    "name": "Theatres 14 - 15 (Ocean Theatres)",
    "type": "theatres",
    "icon": "🔪",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "caterpillar-outpatients-octav-botnar-wing-2",
    "name": "Caterpillar Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "gastroenterology-investigation-suite-octav-botnar-wing-3",
    "name": "Gastroenterology Investigation Suite",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "kingfisher-ward-octav-botnar-wing-3",
    "name": "Kingfisher Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "butterfly-ward-octav-botnar-wing-4",
    "name": "Butterfly Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "gene-therapy-unit-octav-botnar-wing-4",
    "name": "Gene Therapy Unit",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "bumblebee-ward-octav-botnar-wing-5",
    "name": "Bumblebee Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "sky-ward-octav-botnar-wing-6",
    "name": "Sky Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "ophthalmology-office-octav-botnar-wing-7",
    "name": "Ophthalmology Office",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "staff-roof-garden-octav-botnar-wing-7",
    "name": "Staff Roof Garden",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "octav-botnar-wing",
    "building": "Octav Botnar Wing",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522346,
      "lng": -0.119348
    }
  },
  {
    "id": "prev-orangery-orangery-2",
    "name": "Prev. Orangery",
    "type": "other",
    "icon": "📍",
    "buildingId": "orangery",
    "building": "Orangery",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "other",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522609,
      "lng": -0.120753
    }
  },
  {
    "id": "cats-ormond-house-2",
    "name": "CATS",
    "type": "office",
    "icon": "🏢",
    "buildingId": "ormond-house",
    "building": "Ormond House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521695,
      "lng": -0.120481
    }
  },
  {
    "id": "occupational-health-ormond-house-3",
    "name": "Occupational Health",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "ormond-house",
    "building": "Ormond House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.521695,
      "lng": -0.120481
    }
  },
  {
    "id": "clinical-coding-paul-ogorman-building-1",
    "name": "Clinical Coding",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "crf-offices-paul-ogorman-building-1",
    "name": "CRF Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "storage-paul-ogorman-building-1",
    "name": "Storage",
    "type": "storage",
    "icon": "📦",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "chairman-paul-ogorman-building-2",
    "name": "Chairman",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "charles-west-room-paul-ogorman-building-2",
    "name": "Charles West room",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "chief-executive-paul-ogorman-building-2",
    "name": "Chief Executive",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "executive-office-paul-ogorman-building-2",
    "name": "Executive Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "clinical-operations-paul-ogorman-building-3",
    "name": "Clinical Operations",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "directorate-of-nursing-paul-ogorman-building-3",
    "name": "Directorate of Nursing",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "medical-director-paul-ogorman-building-3",
    "name": "Medical Director",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "anaesthetics-paul-ogorman-building-4",
    "name": "Anaesthetics",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "pain-control-service-paul-ogorman-building-4",
    "name": "Pain Control Service",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "orthopaedics-and-spinal-surgery-paul-ogorman-building-5",
    "name": "Orthopaedics and Spinal Surgery",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "specialist-neonatal-and-paediatric-surge-paul-ogorman-building-5",
    "name": "Specialist Neonatal and Paediatric Surgery",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "surgery-unit-management-paul-ogorman-building-5",
    "name": "Surgery Unit Management",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "clinical-governance-and-safety-paul-ogorman-building-6",
    "name": "Clinical Governance and Safety",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "transformation-paul-ogorman-building-6",
    "name": "Transformation",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "cleft-lip-and-palate-offices-paul-ogorman-building-7",
    "name": "Cleft Lip and Palate Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "craniofacial-offices-paul-ogorman-building-7",
    "name": "Craniofacial Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "plastic-surgery-offices-paul-ogorman-building-7",
    "name": "Plastic Surgery Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "paul-ogorman-building",
    "building": "Paul O'Gorman Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522603,
      "lng": -0.120145
    }
  },
  {
    "id": "post-room-southwood-building-1",
    "name": "Post Room",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "legal-offices-southwood-building-1",
    "name": "Legal Offices",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "special-feed-unit-southwood-building-1",
    "name": "Special Feed Unit",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "cvvh-store-southwood-building-1",
    "name": "CVVH Store",
    "type": "storage",
    "icon": "📦",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "C",
    "sideLabel": "Block C",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "radio-lollipop-southwood-building-1",
    "name": "Radio Lollipop",
    "type": "storage",
    "icon": "📦",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "C",
    "sideLabel": "Block C",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "ict-build-room-southwood-building-1",
    "name": "ICT Build Room",
    "type": "storage",
    "icon": "📦",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "C",
    "sideLabel": "Block C",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "redevelopment-group-2-store-southwood-building-1",
    "name": "Redevelopment Group 2 store",
    "type": "storage",
    "icon": "📦",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "C",
    "sideLabel": "Block C",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "telecoms-southwood-building-1",
    "name": "Telecoms",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "C",
    "sideLabel": "Block C",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "mitie-changing-rooms-southwood-building-1",
    "name": "MITIE Changing Rooms",
    "type": "changing",
    "icon": "🚿",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "D",
    "sideLabel": "Block D",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "mitie-offices-southwood-building-1",
    "name": "MITIE Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "D",
    "sideLabel": "Block D",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "turtle-imaging-suite-southwood-building-1",
    "name": "Turtle Imaging Suite",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "social-work-services-southwood-building-2",
    "name": "Social Work Services",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "B",
    "sideLabel": "Block B",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "activity-centre-southwood-building-2",
    "name": "Activity Centre",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "school-southwood-building-2",
    "name": "School",
    "type": "clinical-support",
    "icon": "🎓",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "civas-southwood-building-2",
    "name": "CIVAS",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "clinical-site-practitioners-csp-office-southwood-building-2",
    "name": "Clinical Site Practitioners (CSP) Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "medical-illustration-southwood-building-2",
    "name": "Medical Illustration",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "multi-faith-room-southwood-building-2",
    "name": "Multi Faith Room",
    "type": "non-clinical-support",
    "icon": "⛪",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "security-southwood-building-2",
    "name": "Security",
    "type": "office",
    "icon": "🛡️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "ecmo-store-southwood-building-3",
    "name": "ECMO Store",
    "type": "storage",
    "icon": "📦",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "puffin-day-unit-southwood-building-3",
    "name": "Puffin Day Unit",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "B",
    "sideLabel": "Block B",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "prev-magpie-southwood-building-3",
    "name": "Prev. Magpie",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "prev-island-short-stay-southwood-building-3",
    "name": "Prev. Island Short Stay",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "prev-puffin-day-care-southwood-building-3",
    "name": "Prev. Puffin Day Care",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "tpn-southwood-building-4",
    "name": "TPN",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "magpie-southwood-building-4",
    "name": "Magpie",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "starfish-ward-ranu-southwood-building-4",
    "name": "Starfish Ward (RANU)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "clinical-neurophysiology-eeg-southwood-building-4",
    "name": "Clinical Neurophysiology (EEG)",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "respiratory-sleep-unit-southwood-building-5",
    "name": "Respiratory Sleep Unit",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "B",
    "sideLabel": "Block B",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "rainforest-ward-endocrine-metabolic-southwood-building-5",
    "name": "Rainforest Ward - Endocrine / Metabolic",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "rainforest-ward-gastro-southwood-building-5",
    "name": "Rainforest Ward - Gastro",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "gastroenterology-offices-southwood-building-5",
    "name": "Gastroenterology Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "metabolic-offices-southwood-building-5",
    "name": "Metabolic Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "portex-offices-southwood-building-5",
    "name": "Portex Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "audiology-offices-southwood-building-6",
    "name": "Audiology Offices",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "central-booking-offices-southwood-building-6",
    "name": "Central Booking Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "penguin-ward-southwood-building-6",
    "name": "Penguin Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "penguin-ward-southwood-building-6-2",
    "name": "Penguin Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "dermatology-office-southwood-building-6",
    "name": "Dermatology Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "penguin-ward-southwood-building-6-3",
    "name": "Penguin Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "eagle-office-southwood-building-7",
    "name": "Eagle office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "renal-support-unit-southwood-building-7",
    "name": "Renal Support Unit",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "B",
    "sideLabel": "Block B",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "peter-pan-southwood-building-7",
    "name": "Peter Pan",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "peter-pan-southwood-building-7-2",
    "name": "Peter Pan",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "urodynamics-southwood-building-7",
    "name": "Urodynamics",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "badger-and-miffy-ward-shared-services-e--southwood-building-8",
    "name": "Badger and MIFFY Ward - Shared Services e.g. Play, Gym, Offices",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "miffy-tcu-transitional-care-unit-southwood-building-8",
    "name": "Miffy TCU (Transitional Care Unit)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "badger-ward-southwood-building-8",
    "name": "Badger Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "badger-ward-southwood-building-8-2",
    "name": "Badger Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 8,
    "floorLabel": "Level 8",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "safari-outpatients-southwood-building-9",
    "name": "Safari Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 9,
    "floorLabel": "Level 9",
    "side": "B",
    "sideLabel": "Block B",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "safari-daycare-southwood-building-9",
    "name": "Safari Daycare",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 9,
    "floorLabel": "Level 9",
    "side": "C",
    "sideLabel": "Block C",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "safari-daycare-southwood-building-9-2",
    "name": "Safari Daycare",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 9,
    "floorLabel": "Level 9",
    "side": "D",
    "sideLabel": "Block D",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "safari-daycare-southwood-building-9-3",
    "name": "Safari Daycare",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 9,
    "floorLabel": "Level 9",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "adolescent-medicine-department-southwood-building-10",
    "name": "Adolescent Medicine Department",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 10,
    "floorLabel": "Level 10",
    "side": "B",
    "sideLabel": "Block B",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "cns-offices-southwood-building-10",
    "name": "CNS Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 10,
    "floorLabel": "Level 10",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "endocrine-office-southwood-building-10",
    "name": "Endocrine Office",
    "type": "office",
    "icon": "🏢",
    "buildingId": "southwood-building",
    "building": "Southwood Building",
    "floor": 10,
    "floorLabel": "Level 10",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522697,
      "lng": -0.121074
    }
  },
  {
    "id": "balfour-beatty-offices-southwood-courtyard",
    "name": "Balfour Beatty Offices",
    "type": "storage",
    "icon": "📦",
    "buildingId": "southwood-courtyard",
    "building": "Southwood Courtyard",
    "floor": null,
    "floorLabel": "",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522841,
      "lng": -0.120853
    }
  },
  {
    "id": "fetal-medicine-the-royal-london-hospital-for-integrated-medicine-1",
    "name": "Fetal Medicine",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "the-royal-london-hospital-for-integrated-medicine",
    "building": "The Royal London Hospital for Integrated Medicine",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522048,
      "lng": -0.121238
    }
  },
  {
    "id": "gosh-outpatients-the-royal-london-hospital-for-integrated-medicine-1",
    "name": "GOSH Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "the-royal-london-hospital-for-integrated-medicine",
    "building": "The Royal London Hospital for Integrated Medicine",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522048,
      "lng": -0.121238
    }
  },
  {
    "id": "gosh-outpatients-the-royal-london-hospital-for-integrated-medicine-2",
    "name": "GOSH Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "the-royal-london-hospital-for-integrated-medicine",
    "building": "The Royal London Hospital for Integrated Medicine",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522048,
      "lng": -0.121238
    }
  },
  {
    "id": "gosh-outpatients-the-royal-london-hospital-for-integrated-medicine-4",
    "name": "GOSH Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "the-royal-london-hospital-for-integrated-medicine",
    "building": "The Royal London Hospital for Integrated Medicine",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522048,
      "lng": -0.121238
    }
  },
  {
    "id": "haemophilia-centre-gosh-outpatients-the-royal-london-hospital-for-integrated-medicine-5",
    "name": "Haemophilia Centre (GOSH Outpatients)",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "the-royal-london-hospital-for-integrated-medicine",
    "building": "The Royal London Hospital for Integrated Medicine",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522048,
      "lng": -0.121238
    }
  },
  {
    "id": "shabbat-room-variety-club-building-1",
    "name": "Shabbat Room",
    "type": "non-clinical-support",
    "icon": "⛪",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "cmr-xmr-hybrid-angio-suite-variety-club-building-1",
    "name": "CMR/ XMR Hybrid Angio Suite",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "otter-imaging-suite-variety-club-building-1",
    "name": "Otter Imaging Suite",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "equipment-library-variety-club-building-1",
    "name": "Equipment Library",
    "type": "storage",
    "icon": "📦",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "hydrotherapy-pool-variety-club-building-1",
    "name": "Hydrotherapy Pool",
    "type": "clinical-support",
    "icon": "🔬",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "iv-fluid-store-variety-club-building-1",
    "name": "IV Fluid Store",
    "type": "storage",
    "icon": "📦",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "maxillofacial-and-dental-storage-sri-lan-variety-club-building-1",
    "name": "Maxillofacial & Dental Storage + Sri Lankan Archive",
    "type": "storage",
    "icon": "📦",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "medical-equipment-and-decontamination-un-variety-club-building-1",
    "name": "Medical Equipment and Decontamination Unit (MEDU)",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "pacs-department-variety-club-building-1",
    "name": "PACS Department",
    "type": "office",
    "icon": "🏢",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "pharmacy-distribution-variety-club-building-1",
    "name": "Pharmacy Distribution",
    "type": "storage",
    "icon": "💊",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "storage-disposal-cages-variety-club-building-1",
    "name": "Storage/Disposal Cages",
    "type": "storage",
    "icon": "📦",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "W",
    "sideLabel": "West side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "anaesthetics-pre-assessment-clinic-variety-club-building-2",
    "name": "Anaesthetics Pre-Assessment Clinic",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "cheetah-outpatients-variety-club-building-2",
    "name": "Cheetah Outpatients",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "family-accommodation-variety-club-building-2",
    "name": "Family Accommodation",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "main-reception-variety-club-building-2",
    "name": "Main Reception",
    "type": "non-clinical-support",
    "icon": "💁",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "outpatients-reception-variety-club-building-2",
    "name": "Outpatients Reception",
    "type": "non-clinical-support",
    "icon": "💁",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "patient-advice-and-liaison-service-pals-variety-club-building-2",
    "name": "Patient Advice and Liaison Service (PALS)",
    "type": "office",
    "icon": "💁",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "patient-transport-variety-club-building-2",
    "name": "Patient Transport",
    "type": "office",
    "icon": "🏢",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "outpatients-treatment-rooms-variety-club-building-2",
    "name": "Outpatients Treatment Rooms",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Contractors remit",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "transport-reimbursement-variety-club-building-2",
    "name": "Transport Reimbursement",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "dexa-room-in-x-ray-variety-club-building-2",
    "name": "Dexa Room (in X-ray)",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "x-ray-variety-club-building-2",
    "name": "X Ray",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "maxillofacial-and-dental-variety-club-building-2",
    "name": "Maxillofacial & Dental",
    "type": "clinical",
    "icon": "🩺",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "pharmacy-variety-club-building-2",
    "name": "Pharmacy",
    "type": "clinical-support",
    "icon": "💊",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "st-christophers-chapel-variety-club-building-2",
    "name": "St Christopher's Chapel",
    "type": "non-clinical-support",
    "icon": "⛪",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "theatre-change-female-variety-club-building-3",
    "name": "Theatre Change Female",
    "type": "changing",
    "icon": "🔪",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "theatres-1-6-variety-club-building-variety-club-building-3",
    "name": "Theatres 1-6 (Variety Club Building)",
    "type": "theatres",
    "icon": "🔪",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "interventional-radiology-angiography-sui-variety-club-building-3",
    "name": "Interventional Radiology (Angiography Suites 1, 2 and 3)",
    "type": "clinical",
    "icon": "🩻",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "woodpecker-ward-same-day-admissions-unit-variety-club-building-3",
    "name": "Woodpecker Ward (Same Day Admissions Unit)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "neonatal-intensive-care-unit-nicu-variety-club-building-4",
    "name": "Neonatal Intensive Care Unit (NICU)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "theatre-change-male-variety-club-building-4",
    "name": "Theatre Change Male",
    "type": "changing",
    "icon": "🔪",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "E",
    "sideLabel": "East side",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "paediatric-intensive-care-unit-picu-variety-club-building-4",
    "name": "Paediatric Intensive Care Unit (PICU)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "general-surgery-pre-admissions-on-squirr-variety-club-building-5",
    "name": "General Surgery Pre-Admissions (on Squirrel Ward)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "squirrel-ward-variety-club-building-5",
    "name": "Squirrel Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "urology-pre-admissions-on-squirrel-ward-variety-club-building-5",
    "name": "Urology Pre-Admissions (on Squirrel Ward)",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "fox-ward-variety-club-building-5",
    "name": "Fox Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "robin-ward-variety-club-building-5",
    "name": "Robin Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "giraffe-ward-variety-club-building-6",
    "name": "Giraffe Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "lion-ward-variety-club-building-6",
    "name": "Lion Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "E",
    "sideLabel": "East side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "elephant-ward-variety-club-building-6",
    "name": "Elephant Ward",
    "type": "ward",
    "icon": "🛏️",
    "buildingId": "variety-club-building",
    "building": "Variety Club Building",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "W",
    "sideLabel": "West side",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522377,
      "lng": -0.120331
    }
  },
  {
    "id": "linen-room-west-link-1",
    "name": "Linen Room",
    "type": "non-clinical-support",
    "icon": "🧺",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "sewing-room-west-link-1",
    "name": "Sewing Room",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "cashiers-west-link-2",
    "name": "Cashiers",
    "type": "office",
    "icon": "🏢",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "staff-treatment-room-massage-services-west-link-2",
    "name": "Staff Treatment Room/ Massage Services",
    "type": "non-clinical-support",
    "icon": "🛎️",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "immunology-offices-west-link-3",
    "name": "Immunology Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "infectious-diseases-west-link-3",
    "name": "Infectious Diseases",
    "type": "office",
    "icon": "🏢",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "medicine-dts-offices-west-link-4",
    "name": "Medicine DTS Offices",
    "type": "office",
    "icon": "🏢",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "pharmacy-west-link-4",
    "name": "Pharmacy",
    "type": "office",
    "icon": "💊",
    "buildingId": "west-link",
    "building": "West Link",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.522085,
      "lng": -0.120487
    }
  },
  {
    "id": "education-and-training-department-weston-house-1",
    "name": "Education & Training Department",
    "type": "teaching-research",
    "icon": "📚",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 1,
    "floorLabel": "Level 1",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "education-and-training-department-weston-house-2",
    "name": "Education & Training Department",
    "type": "teaching-research",
    "icon": "📚",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 2,
    "floorLabel": "Level 2",
    "side": "",
    "sideLabel": "",
    "access": "staff",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "patient-hotel-weston-house-3",
    "name": "Patient Hotel",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "pgme-weston-house-3",
    "name": "PGME",
    "type": "office",
    "icon": "🏢",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 3,
    "floorLabel": "Level 3",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "patient-hotel-tcu-flats-weston-house-4",
    "name": "Patient Hotel/TCU Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 4,
    "floorLabel": "Level 4",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "patient-hotel-tcu-flats-weston-house-5",
    "name": "Patient Hotel/TCU Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "patient-hotel-tcu-flats-weston-house-5-2",
    "name": "Patient Hotel/TCU Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 5,
    "floorLabel": "Level 5",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "patient-hotel-tcu-flats-weston-house-6",
    "name": "Patient Hotel/TCU Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 6,
    "floorLabel": "Level 6",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "patient-hotel-tcu-flats-weston-house-7",
    "name": "Patient Hotel/TCU Flats",
    "type": "residential",
    "icon": "🏨",
    "buildingId": "weston-house",
    "building": "Weston House",
    "floor": 7,
    "floorLabel": "Level 7",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "coordinates": {
      "lat": 51.52175,
      "lng": -0.12111
    }
  },
  {
    "id": "main-entrance-entrance",
    "name": "Main Entrance",
    "type": "entrance",
    "icon": "🚪",
    "buildingId": "",
    "building": "Site entrance",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "description": "Main hospital entrance (off Guilford Street)",
    "coordinates": {
      "lat": 51.523095,
      "lng": -0.120922
    }
  },
  {
    "id": "ambulance-entrance-entrance",
    "name": "Ambulance Entrance",
    "type": "entrance",
    "icon": "🚪",
    "buildingId": "",
    "building": "Site entrance",
    "floor": 0,
    "floorLabel": "Ground",
    "side": "",
    "sideLabel": "",
    "access": "public",
    "status": "Occupied",
    "description": "Emergency / ambulance access only",
    "coordinates": {
      "lat": 51.52237,
      "lng": -0.121013
    }
  }
]
