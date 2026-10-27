# Findway in ChatGPT (and other AI assistants)

Findway runs an MCP server at **`https://findway.ai/api/mcp`**. ChatGPT's app directory lists apps built on it. Claude and other assistants can use it as a connector.

The server is read-only and needs no sign-in. It answers from the same map data as the app and the hospital pages, and keeps nothing it is asked.

| Tool | Answers | Example |
| --- | --- | --- |
| `find_place` | Where a ward, clinic, department, entrance or facility is inside a mapped hospital, with a directions link | "Where is Kangaroo Ward at Great Ormond Street?" |
| `find_hospital` | Which hospital: its address, whether Findway maps its inside, its page, directions there | "Find Medway Maritime Hospital" |
| `list_places` | What a mapped hospital's map holds, optionally one kind (entrances, wards, departments, facilities, other) | "What wards are at Great Ormond Street?" |

Common words are understood: A&E (Emergency Department), X-ray (Radiology, Imaging), blood test (Phlebotomy), café, toilets and others. For a hospital Findway has no inside map of, the answer says so and gives directions to the hospital rather than guessing.

Code: `src/lib/mcp/` and `src/app/api/mcp/route.ts`. Tests: `scripts/lib-test/mcp.test.mjs`.

## 1. Try it in your own ChatGPT first

These menu names were current when this was written. ChatGPT renames them from time to time.

1. In ChatGPT, open **Settings → Apps** (or **Apps & Connectors**) **→ Advanced settings**, and turn on **Developer mode**.
2. Click **Create** (app or connector):
   - **Name:** Findway
   - **MCP server URL:** `https://findway.ai/api/mcp`
   - **Authentication:** None
3. Start a new chat, pick **Findway** from the **+** menu (or the developer tools list), and ask the test questions below.
4. Take screenshots of good answers. The submission asks for them.

**Claude:** Settings → **Connectors** → **Add custom connector** → the same URL.

## 2. Submit it to the ChatGPT app directory

1. On **platform.openai.com**, verify the organisation (**Universal Wallet LTD**) under organisation settings. You can't submit until this is done.
2. Open the **app submission** page and fill it in. The field names on the form may differ slightly from these.

| Field | Enter |
| --- | --- |
| App name | `Findway` |
| Short description | `Find wards, clinics and departments inside UK hospitals, with step-by-step directions.` |
| Description | `Findway maps NHS hospitals inside. Ask where a ward, clinic, department, entrance or facility is, and Findway says which building and floor it is on and gives a link to step-by-step walking directions from the entrance. It can also find a hospital by name, town or postcode and give directions there. Findway gives directions only, not medical advice.` |
| Category | Travel or Navigation (not Health or Medical) |
| Logo | `public/icon-512.png` |
| MCP server URL | `https://findway.ai/api/mcp` |
| Authentication | None |
| Privacy policy | `https://findway.ai/privacy` |
| Support / contact | `https://findway.ai/support` |
| Countries | United Kingdom |

### Test cases

**Should work:**

| Ask | Expected |
| --- | --- |
| Where is Kangaroo Ward at Great Ormond Street Hospital? | `find_place`: Premier Inn Clinical Building, Level 2, with a directions link |
| Where can I get a blood test at St George's Hospital in Tooting? | `find_place`: Blood Testing, Ground Floor, Lanesborough Wing |
| Where is A&E at St George's Hospital, Tooting? | `find_place`: Emergency Department (ED), Ground Floor |
| What wards are there at Great Ormond Street Hospital? | `list_places` (wards): 29 wards, each with where it is |
| How do I get to Medway Maritime Hospital? | `find_hospital`: Windmill Road, Gillingham ME7 5NY, its Findway page and Apple or Google Maps directions |

**Should decline gracefully:**

| Ask | Expected |
| --- | --- |
| Where is the X-ray department at Royal Oldham Hospital? | No inside map yet: says so, offers directions to the hospital, invents no location |
| Where is Ward 3 at Mars General Hospital? | No such hospital: says so |
| What should I take for a headache? | Not a wayfinding question; Findway is not used |

## Rules this follows
- **Read-only:** every tool is marked `readOnlyHint` and changes nothing.
- **Plain descriptions:** no advertising in tool descriptions or answers.
- **Directions only:** never advice about health, and nothing about why someone is going somewhere.
- **No logging of questions:** none are stored. The privacy page says so under "Findway in ChatGPT and other AI assistants".
