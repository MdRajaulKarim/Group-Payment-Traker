<!-- GROUP PAYMENT TRACKER — ReadMe -->
  <!-- © 2026 All copyright belongs to IndiProtoHub LLP -->

# Group Payment Tracker

Group Payment Tracker is a modern web application built for friends, roommates, travel groups  &amp; families to simplify shared expense management. Users calculate each person's share and generate an optimized settlement. The application works entirely offline, keeping all financial information private while providing fast &amp; accurate calculations.

A **no-login** web app for splitting shared expenses in a group
(trips, flatmates, team lunches). Plain HTML/CSS/JS — **zero dependencies, no
build step**. Open `index.html` and it works offline. All data is saved in the
browser's `localStorage`; nothing leaves the device unless you export or share.

Design direction: **a ledger.** Ruled rows, quiet grey chrome, and big
tabular-figure numerals so amounts line up like a bank statement. Colour is used
only where it means something — owed / owes / settled — and each of those also
carries a sign and a word so the state survives greyscale and colour-blindness.

---

## Using it

1. **Members** → *Add member* — add everyone. Add more at any time.
2. **Add expense** — a row with Date, Title, Amount, Method (Cash/UPI), Paid by,
   and **Split between** — a floating dropdown of checkboxes (with *All* /
   *Clear*); the chosen names stay visible in the dropdown's summary.
3. Watch **Running balances** update live as you type.
4. **Calculate settlement** — full breakdown plus a minimal *who-pays-whom* list.
5. **Copy**, **Download .txt**, or **Share on WhatsApp**. **Clear all** to reset everything, 
or **Keep members & clear expenses** to start a new trip with the same group.

To **delete an expense**, click the **✕** on the right of its row; a message asks
you to click **✕** again within 3 seconds to confirm (and a 7-second **Undo**
appears after it's gone).

**Backup & restore:** *Export data* saves everything to a
`group-payments-backup-<date>.json` file. You have two ways to load it back: *Import data* replaces your current data entirely, while *Import & Merge* intelligently combines the file with your current data (matching members by name and skipping duplicate expenses). Use it to move a trip between browsers or devices, or just to keep a safe copy — the settlement`.txt` / WhatsApp exports are summaries, this is the real data.

**Prorating:** a new expense defaults to splitting between the members active on
its date, so someone who joins late isn't charged for earlier expenses. It's a
*default*, not a cage — tick or untick anyone on any row (e.g. someone skipped
that meal).

---

## What changed in this rewrite

### Correctness (Part 1)
- **No more stale exports.** Results are recomputed from state on every edit, and
  every export is built fresh at click time. There is no cached summary, so you
  can never download numbers that don't match the screen. *(1.1)*
- **One total, one definition.** The header total and the settlement total are
  the same function. Rows with no/again-non-positive amounts are excluded and the
  settlement lists exactly which rows were dropped and why. *(1.2, 1.9)*
- **Editable participants.** The *Split between* cell is a per-row dropdown of
  checkboxes showing **names**, not a read-only count. You can exclude anyone from
  a single expense, and a member added after a blank row was created can now be
  ticked in. *(1.3)*
- **Money is integer paise end to end** with a deterministic rounding rule
  (below), so shares and balances reconcile exactly. Settlement transfers are
  rounded to whole rupees for real-world cash/UPI. *(1.4)*
- **Split membership is always visible** (names in the dropdown summary), not
  hidden in a tooltip. *(1.5)*
- **Mobile table → cards** under 620px; no sideways scrolling. *(1.6)*
- **Contrast fixed and audited.** Every semantic colour meets WCAG AA (≥4.5:1);
  the dark theme overrides **every** semantic token; recomputed ratios are in a
  comment block at the top of `style.css`. Owed/owes/settled also use a sign
  (`+ / − / =`) and a word. *(1.7)*
- **Safer destructive actions.** Deleting an expense is a **two-step, 3-second
  confirm** — the ✕ (on the right of the row) arms and shows a message; a second
  click within 3 seconds deletes it, then a 7-second **Undo** toast appears.
  Removing a member is also undoable. **Clear all** is a proper dialog offering
  *Download backup first*, with corrected copy. *(1.8)*
- **Smaller fixes:** removing a member now refreshes the expense rows; payer
  correction is persisted (never a silent render-time mutation); `loadState`
  validates/repairs any saved object; **duplicate member names are rejected**
  (re-adding a removed name reactivates that member instead of duplicating);
  **Date** is a real editable column (defaults to today); amount uses
  `step="any"` (no coarse ₹10 arrow jumps); untitled rows are flagged. *(1.9)*

### Usability (Part 2)
Mobile-first cards; a teaching empty state; always-on **Running balances**;
per-row *"₹X each"* hints; copy-to-clipboard; WhatsApp share with a length
warning/truncation. The **Split between** control is a floating dropdown that
stays put while you use it and **only one is open at a time**; it closes on an
outside click but won't close while nobody is selected (it nudges you to pick
someone), so no expense can be silently split among no one. The expenses table no
longer shows a spurious vertical scrollbar (it scrolls horizontally only when it
must). **Backup & restore** (Export/Import `.json`) keeps a full copy of your
data and moves it between devices; import is undoable. Running balances render as
colour-accented **stat tiles** and each settlement row shows a sign badge +
amount, so who-owes-what reads at a glance.

### Accessibility (Part 3)
Every control has an accessible name; Members button uses
`aria-expanded`/`aria-controls`; visible `:focus-visible` outlines everywhere;
touch targets ≥44px on touch devices; the settlement is announced via `aria-live`
**once on Calculate** (not re-announced on every keystroke); fully
keyboard-operable including the Clear dialog (Escape / backdrop to close).

### Deliberately *not* done
- **No auto who-owes-whom in exact paise.** Transfers are whole rupees on
  purpose — nobody hands over 34 paise. Per-person balances remain exact.
- **No tabs/routing/settings screen** — the information architecture is
  unchanged, as requested.
- **The v1 `localStorage` key is not deleted** after migration; it's kept as a
  backup so no saved trip can be lost.

---

## Data & storage

### State shape (`gpt_state_v2`)

```jsonc
{
  "version": 2,
  "members": [
    { "id": "ab12c", "name": "Priya", "active": true }
  ],
  "transactions": [
    {
      "id": "de34f",
      "title": "Auto fare",
      "amountPaise": 12000,        // integer paise (₹120.00); null = not entered
      "method": "Cash",            // "Cash" | "UPI"
      "paidBy": "ab12c",           // member id; always one of `participants`
      "participants": ["ab12c"],   // member ids sharing THIS expense (editable)
      "date": "2026-08-06",        // YYYY-MM-DD, editable
      "createdAt": 1754460000000   // ms timestamp (ordering/debug)
    }
  ]
}
```

Removing a member who already appears in an expense **soft-removes** them
(`active:false`) so historical splits stay balanced; they show as *removed* in
results. A member with no history is deleted outright.

### Migration from `gpt_state_v1`

On load the app looks for `gpt_state_v2` first. If it's absent but a
`gpt_state_v1` record exists, it is migrated once and written to `gpt_state_v2`
(the v1 key is left untouched as a backup):

| v1 field | v2 field | conversion |
|---|---|---|
| `amount` (rupee string, e.g. `"120"`) | `amountPaise` | `round(parseFloat × 100)`; blank/NaN → `null` |
| `createdAt` (ms) | `date` | `YYYY-MM-DD` from the timestamp; also kept as `createdAt` |
| `method` | `method` | `"UPI"` stays `"UPI"`, everything else → `"Cash"` |
| `members`, `paidBy`, `participants` | same | carried over; ids preserved |

Any partial or corrupted object (v1 *or* v2) is passed through a `normalize()`
repair pass that coerces types, drops references to non-existent members, and
guarantees the payer is one of the participants. If nothing usable is found, the
app starts from a clean empty state — saved data is never silently discarded.

### Rounding rule

- All money is stored and computed as **integer paise**. No floats are ever
  persisted or accumulated.
- For an expense of `A` paise split between `n` participants: each gets
  `floor(A / n)` paise, and the indivisible remainder `A − floor(A/n)·n` (always
  `< n` paise) is added to **one** participant — the payer if they're in the
  split, otherwise the first participant. Per-expense shares therefore sum to
  **exactly** `A`, and every member's balance (`paid − share`) nets to exactly
  zero across the group. The UI names whoever absorbed the extra paise.
  - *Example:* ₹100 between 3 → ₹33.34 + ₹33.33 + ₹33.33 = ₹100.00 (not ₹99.99).
- **Settlement transfers** ("who pays whom") are rounded to **whole rupees** for
  practical cash/UPI payment; rounding residual is nudged so the transfers still
  sum to zero. The exact per-person balances are always shown alongside.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Structure and accessible markup. |
| `style.css` | Ledger theme, tokens, light/dark, responsive cards, contrast audit. |
| `script.js` | State, migration, prorating, paise math, live results, export. |
| `README.md` | This file. |

---
*© 2026 All copyright belongs to IndiProtoHub LLP*