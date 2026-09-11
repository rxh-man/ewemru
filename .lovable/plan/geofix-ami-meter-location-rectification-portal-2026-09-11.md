# GeoFix — AMI meter location rectification portal

A new page at `fieldone.live/geofix`, e& themed (black/red, same look as the AI slides you shared), built on your MRU master sheet.

## Data behind the page

Both sheets from the uploaded workbook are loaded into the backend once:
- Energy: 198,104 meter points
- Water: 102,101 meter points

Each line keeps area, account no., premise, serial (USN / water serial), MSN, type, MRU, premise description, current latitude/longitude, building name and building ID, installation status and action required.

A field engineer finds a line by typing the **meter serial number** (also works for MSN or account no.). Search runs server-side, so the full 300k list stays fast on a phone.

## Roles

**Field engineer** (e.g. `raja` / `0001`)
- Only two things: search a meter, and submit a rectification for it.
- No access to the master list, no editing of other data.

**Manager** (`manager` / `53786`)
- Sees every rectification submitted by his team in one single list, with the person who submitted it, the meter, the scenario, old vs new coordinates and the time.
- Filter by week (default: this week) and by team member.
- Marks a request Approved or Rejected; approving writes the new coordinates onto the master line.
- Creates and removes field engineer accounts under him.
- Downloads the list as an Excel report.

## The three field scenarios

1. **Wrong meter at this location** — a different meter is installed at the coordinates. The engineer records the serial actually found, searches it, and says whether it belongs nearby or is completely misplaced. Correct coordinates can be pushed to the meter that was found.
2. **Meter found nearby, coordinates wrong** — the meter is right but standing a little away. The engineer captures the true coordinates (device GPS button or manual entry) and submits the correction.
3. **No meter / no workman data at site** — nothing installed at the coordinates; the engineer flags it with remarks and a photo-free note so the master line is marked for re-survey.

Every submission stores who, when, what changed, and free-text remarks, so the log is auditable.

## Technical notes

- New tables: `geofix_meters` (bulk master, indexed on serial/msn/account), `geofix_requests` (rectification log), `geofix_field_users` (team accounts under the manager). Grants + RLS in the same migration.
- Bulk import of the workbook via server-side COPY, not through the browser.
- Search and submit go through a small edge function so no 300k-row payload ever reaches the client.
- Route `/geofix` plus the obscured slug pattern used elsewhere; sign-in reuses the existing session helper so it stays isolated from the other portals.
- Excel export with the `xlsx` package already in the project.
