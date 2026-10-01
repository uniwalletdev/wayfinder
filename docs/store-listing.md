# Store listings: Findway Map (App Store) and Findway (Google Play)

Everything the two consoles ask for before the app can go beyond internal
testing, written from what the code does. Paste the text fields as they are;
the form answers say which box to pick and why. Character limits are checked.

Screenshots and Play's feature graphic come from *Actions → Store screenshots
→ Run workflow*; download its `store-screenshots` artifact. Each folder is
named for the slot it fills.

## Things to know first

- **Keep "NHS" out of the store text.** NHS England's identity rules bar
  non-NHS organisations from using the NHS name in a product's name or
  marketing without Department of Health permission, and Apple refuses
  trademarked terms in keywords. The copy below says "hospitals" throughout.
  Trust names inside the app are data, which is fine.
- **Floor plans are traced from trusts' published site maps.** Both consoles
  ask whether the app shows third-party content; the answer is yes. Before a
  public release, confirm each trust is content for its map to be reused in a
  commercial app, or limit the public build to venues you have permission
  for. `data/plan-sources.json` records where every map came from.
- **Launch in the United Kingdom only.** Every venue is in England. A UK-only
  release also sidesteps the EU Digital Services Act trader-status banner in
  App Store Connect until you want EU distribution.

## Text

| Field | Text |
| --- | --- |
| App Store name (30) | `Findway Map` |
| Google Play name (30) | `Findway` |
| App Store subtitle (30) | `Indoor hospital navigation` |
| Google Play short description (80) | `Find any ward, clinic or department in hospital, floor by floor, step-free.` |
| App Store promotional text (170) | `Lost in a hospital corridor? Search the ward or clinic you need and follow the line, floor by floor and lift by lift. No sign-in, and maps work without signal.` |
| App Store keywords (100) | `hospital,indoor,wayfinding,ward,clinic,directions,floor plan,map,step-free,accessible,lift,route` |

### Description (both stores)

```
Findway gets you from the front door to the right ward, clinic or department, one clear step at a time.

Hospitals are hard to navigate: dozens of buildings, floors that don't line up, signs that change halfway down a corridor. Findway puts the whole building in your pocket.

SEARCH ANY WARD OR CLINIC
Type a ward, a clinic or a department. Every floor ranks in one list, nearest first.

FOLLOW THE LINE
Turn-by-turn guidance across floors and buildings, lifts included, with live re-routing the moment you take a wrong turn. A gentle vibration marks each turn, and spoken directions read every step aloud if you want them.

STEP-FREE BY DEFAULT
A change of floor goes by lift unless you choose otherwise. Where a faster route uses stairs, Findway offers both and says which is which.

WORKS WITHOUT SIGNAL
Basement corridors are where signal dies. The maps are inside the app, so search and routes keep working with no connection.

SCAN A POSTER, START WALKING
Scan a Findway QR code on a wall to place yourself on the map instantly, or share a destination with a relative as a link.

MORE THAN 60 HOSPITALS
Over sixty hospitals across England are mapped so far, and more are added all the time.

PRIVATE BY DESIGN
No account, no adverts, no tracking. Your position is worked out on your phone. The only thing that ever leaves it is an anonymous outline of the corridors you walk while being guided, trimmed so your destination is never recorded, and deleted after 30 days. You can delete it yourself at any time.
```

## Categories, rating, price

| | App Store | Google Play |
| --- | --- | --- |
| Category | Primary **Navigation**, secondary **Utilities** | **Maps & Navigation** |
| Age / content rating | Answer *None* to every question; social-media questions *No*. Result: **4+** | IARC questionnaire, category *Utility, Productivity, Communication, or Other*; answer No throughout. Result: **Everyone / PEGI 3** |
| Price | Free | Free, no ads, no in-app purchases |
| Availability | United Kingdom | United Kingdom |

Avoid the App Store's Medical category: it invites App Review's question
about apps in regulated healthcare fields, which a navigation tool should
never have to answer.

## Privacy: what the app sends, and the form answers

What leaves the phone, from the code:

| Data | When | Kept | Tagged with |
| --- | --- | --- | --- |
| Corridor trace (precise location) | Only while guided, from Start to arrival; last 25 m cut off, rounded to ~1 m | 30 days | Random identifier made on first use |
| Text of searches that found nothing | When a search returns nothing | 90 days | Nothing |
| Approximate position with an address search | When typing an address | Not stored; forwarded to the map provider | Nothing |
| Camera frames or a plan image | Survey Mode and Upload plan, both started deliberately | Not stored; read by an AI model | Nothing |
| Places a user maps and publishes | When they publish a place | Until deleted | Nothing |

No analytics, crash-reporting or advertising SDKs are in the app. Deletion:
*Help and accessibility* (the ? button) → *Privacy* → **Delete my walks from
the server**, which deletes the device's traces and forgets its identifier.

### App Store Connect → App Privacy

- **Do you or your third-party partners collect data?** Yes.
- **Used for tracking?** No, for every type.
- Declare these, each with purpose **App Functionality**:

| Type | Linked to the user? | Why |
| --- | --- | --- |
| Location → Precise Location | Yes | Traces carry the device's random identifier, and Apple counts linkage to a device as linked. |
| Identifiers → Device ID | Yes | The random identifier itself. |
| Search History | No | Stored with no identifier. |
| Photos or Videos | No | Survey Mode frames go to an AI provider; declared so the label is never short of the truth. |
| Other User Content | No | Published places. |

Answering *linked* is the safe reading of Apple's definition: over-declaring
costs a slightly longer label, under-declaring can get the app pulled.

**Privacy Policy URL:** `https://wayfinder-theta.vercel.app/privacy` (move it
to your own domain when you have one).

### Google Play → Data safety

- **Collects or shares user data?** Yes. **Encrypted in transit?** Yes.
- **Users can request deletion?** Yes, in the app, as described above.
- **Shared with third parties?** No. Sending frames or an address to a
  service that processes them for you is not sharing in Play's sense.

| Data type | Collected | Processed ephemerally | Required or optional | Purposes |
| --- | --- | --- | --- | --- |
| Location → Precise location | Yes | No | Optional (only while guided) | App functionality, Analytics |
| Location → Approximate location | Yes | Yes | Optional | App functionality |
| App activity → In-app search history | Yes | No | Optional | App functionality, Analytics |
| App activity → Other user-generated content | Yes | No | Optional | App functionality |
| Photos and videos → Photos | Yes | Yes | Optional | App functionality |
| Device or other IDs | Yes | No | Optional | App functionality |

### Google Play → other App content forms

| Form | Answer |
| --- | --- |
| Privacy policy | `https://wayfinder-theta.vercel.app/privacy` |
| App access | All functionality is available without special access |
| Ads | No, the app contains no ads |
| Target audience | 18 and over. Patients and visitors of every age benefit, but choosing under-13s brings in the Families policy. |
| Health apps declaration | Healthcare services and management |
| News, government, financial features, COVID-19 | No |

## App Review notes (App Store)

Paste into *App Review Information → Notes*. Sign-in required: **No**.

```
Findway is indoor navigation for hospitals. No account is needed.

The reviewer will not be inside a hospital, so to see routing:
1. The app opens on Great Ormond Street Hospital, London. Allow location when asked.
2. Tap the search bar, type "Kangaroo Ward" and tap the result.
3. The app notices you are far from the hospital and offers "Preview from Great Ormond Street Hospital". Tap it: the route draws from inside the hospital to the ward.
4. Tap Start for turn-by-turn guidance, one step at a time.
Try "Ear, Nose and Throat" for a route that changes floor by lift, or the floor button (top right) to browse the levels.

What the app does natively:
- All maps and the interface are bundled in the app, so search and routing work with no connection.
- Location, motion and camera are requested through the system permission prompts, for the blue dot, indoor step-and-compass positioning, and scanning Findway QR posters.
- Turn cues use the system haptics engine; directions can be spoken aloud.

Location leaves the device only while the user is being guided, as an anonymous corridor trace with the destination trimmed off, deleted after 30 days. Users can delete it in the app under Help and accessibility, then Privacy.
```

## Before each public release

1. Run *Store screenshots* and upload the new set if the interface changed.
2. Run *Mobile apps* with **Upload** ticked; the build number rises with each run.
3. Install from TestFlight and Play internal testing and walk the checklist:
   opens on the map in flight mode; location prompt shows its reason; search
   finds a ward; a route draws; address search returns results (proves the
   live API accepts the app); a shared link is a website link; the phone
   buzzes on each step.
4. In App Store Connect, add the build to the version, then *Add for Review*.
   In Play Console, promote the internal release to production.
