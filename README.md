<!-- GROUP PAYMENT TRACKER — README -->
  <!-- © 2026 All copyright belongs to IndiProtoHub LLP -->

# 💰 Group Payment Tracker

### Split expenses. Track balances. Settle up — without accounts or servers.

**Group Payment Tracker** is a privacy-first web application built for managing shared expenses among friends, roommates, travel groups, teams & families to simplify shared expense management.

Calculate everyone's exact share, track running balances and generate an optimized **who-pays-whom settlement** — all directly in your browser.

<p align="center">
  <img src="https://img.shields.io/badge/No%20Login-✓-brightgreen" alt="No Login">
  <img src="https://img.shields.io/badge/Offline-✓-blue" alt="Works Offline">
  <img src="https://img.shields.io/badge/Zero%20Dependencies-✓-orange" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/Privacy-Local%20Storage-purple" alt="Privacy">
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License">
</p>

> **Track expenses. Split fairly. Settle simply.**

---

## 🌐 Live Demo

### [🚀 Launch Group Payment Tracker](https://mdrajaulkarim.github.io/Group-Payment-Traker/)

Open the app directly in your browser — no installation, registration, or login required.

The current app is designed around a simple workflow:

**Members → Expenses → Running balances → Settlement → Share / Export → Backup**

---

## ✨ Why Group Payment Tracker?

Group expenses get complicated fast.

One person pays for the hotel. Someone else pays for dinner. Another person covers transport. By the end, everyone is asking:

> **Who owes whom — and how much?**

Group Payment Tracker turns those scattered payments into a clear expense ledger and a practical settlement plan.

### Built around a few principles

- **Simple:** One page, no unnecessary menus or setup.
- **Private:** Data is stored in your browser.
- **Accurate:** Money is calculated in integer paise.
- **Flexible:** Every expense can have its own participants.
- **Practical:** Settlement transfers are rounded to whole rupees for real-world cash/UPI payments.
- **Accessible:** Balance states use symbols and words as well as colour.

> **A shared expense tracker should be as easy to use as a calculator — while keeping your financial data private.**

---

## ✨ Features

| Feature | Description |
|---|---|
| 👥 **Group Members** | Add, remove and manage members at any time |
| 💸 **Shared Expenses** | Record expenses with title, date, amount, payment method and payer |
| ☑️ **Flexible Splitting** | Choose exactly who participates in each expense |
| 📊 **Running Balances** | See who has paid, owes, or is owed in real time |
| 🧮 **Exact Calculations** | Money is calculated using integer paise to avoid floating-point errors |
| 🤝 **Optimized Settlement** | Generate a minimal who-pays-whom settlement |
| 📋 **Copy Results** | Copy settlement details directly to the clipboard |
| 📱 **WhatsApp Sharing** | Share settlement information with your group |
| 📄 **Text Export** | Download settlement results as `.txt` |
| 💾 **Backup & Restore** | Export and import complete application data |
| 🔄 **Import & Merge** | Combine a backup with existing data without duplicating expenses |
| 📴 **Works Offline** | No server or internet connection required after loading |
| 🔐 **Privacy First** | Data stays in your browser's `localStorage` |
| 🌙 **Dark Theme** | Accessible light and dark themes |
| 📱 **Responsive UI** | Desktop tables automatically become mobile-friendly cards |
| ♿ **Accessible** | Keyboard support, focus states, ARIA labels and accessible controls |

---

# 📖 How to Use

### 1. 👥 Add Members

Go to **Members → Add Member** and add everyone participating in the group.

Members can be added at any time.

### 2. 💳 Add an Expense

Each expense contains:

- Date
- Title
- Amount
- Payment method
- Paid by
- People sharing the expense

The **Split Between** control lets you select exactly who should participate.

You can quickly:

- Select **All**
- **Clear** selections
- Add/remove individual members

### 3. 📊 Monitor Running Balances

Balances update automatically as expenses are entered.

Each member's balance clearly indicates whether they:

```text
+ Owed
- Owes
= Settled
```

Example:

```text
RAJAUL       + ₹35.00   GETS BACK
HABIB        - ₹20.00   OWES
MOSTAQUE     - ₹65.00   OWES
USAMA        - ₹10.00   OWES
```

Each state is communicated through **sign + amount + word**, so the meaning remains clear even without relying on colour.

### 4. 🧮 Calculate Settlement

Click **Calculate Settlement** to generate:

- Total group spending
- Individual balances
- Exact amounts owed
- Optimized payment transfers
- Who should pay whom

For example:

```text
RAJAUL pays MOSTAQUE ₹35
HABIB  pays MOSTAQUE ₹20
USAMA    pays MOSTAQUE ₹10
```

The goal is to minimize unnecessary transactions.

### 5. 📤 Share or Export

Settlement results can be:

- 📋 Copied to clipboard
- 📄 Downloaded as `.txt`
- 💬 Shared through WhatsApp

You can also export the complete application state as JSON for backup.

---

# 💾 Backup & Restore

Your data is stored locally in the browser.

### Export

Use **Export Data** to create a file such as:

```text
group-payments-backup-YYYY-MM-DD.json
```

This contains the complete application state.

### Import

**Import Data** replaces the current data with the selected backup.

### Import & Merge

**Import & Merge** combines the backup with the current data.

The merge process:

- Matches members by name
- Preserves existing members
- Skips duplicate expenses
- Combines compatible data

This makes it useful for moving a trip between browsers or devices.

> Settlement `.txt` files and WhatsApp messages are summaries.
> The JSON backup is the actual restorable application data.

---

# 📅 Smart Prorating

New expenses automatically default to members who were active on the expense date.

For example:

```text
Trip starts:        1 August
Member A joins:     1 August
Member B joins:     5 August
Expense:            3 August
```

Member B won't automatically be included in the 3 August expense.

However, this is only a **default**.

You can manually include or exclude anyone from any individual expense.

---

# 🧮 Accurate Money Calculations

All financial calculations use **integer paise**.

No floating-point values are persisted or accumulated.

For example:

```text
₹100.00 ÷ 3

Participant 1 → ₹33.34
Participant 2 → ₹33.33
Participant 3 → ₹33.33

Total         → ₹100.00
```

The application uses deterministic rounding so every expense reconciles exactly.

### Rounding rule

For an expense of `A` paise split among `n` participants:

```text
base = floor(A / n)

remainder = A - (base × n)
```

Each participant receives `base` paise.

The remaining paise are assigned to:

1. The payer, if they are participating
2. Otherwise, the first participant

Therefore:

```text
Sum of shares = Original expense
```

Settlement transfers are rounded to whole rupees for practical cash/UPI payments, while exact per-person balances remain available in the application.

---

# 🛡️ Safe Data Handling

The application uses:

```text
Browser localStorage
        │
        ├── Members
        └── Transactions
```

Nothing is sent to a remote server by the application.

Your information remains on the device unless **you explicitly export or share it**.

---

# 🔄 Data Model

The current state uses `gpt_state_v2`.

```json
{
  "version": 2,
  "members": [
    {
      "id": "ab12c",
      "name": "Priya",
      "active": true
    }
  ],
  "transactions": [
    {
      "id": "de34f",
      "title": "Auto fare",
      "amountPaise": 12000,
      "method": "Cash",
      "paidBy": "ab12c",
      "participants": ["ab12c"],
      "date": "2026-08-06",
      "createdAt": 1754460000000
    }
  ]
}
```

---

# 🔄 Migration & Data Recovery

The application supports migration from:

```text
gpt_state_v1
      ↓
normalize()
      ↓
gpt_state_v2
```

When loading data, the application:

- Validates stored objects
- Repairs malformed values
- Removes references to nonexistent members
- Ensures the payer is a valid participant
- Preserves historical member references
- Converts old rupee values to integer paise
- Keeps the old v1 storage key as a backup

If no usable data exists, the application starts with a clean state.

Saved data is not silently discarded.

---

# 🗑️ Safe Destructive Actions

Accidental deletion is handled carefully.

### Delete Expense

The first `✕` click arms deletion.

A second click must happen within **3 seconds** to confirm.

After deletion:

```text
Expense deleted
      ↓
Undo available for 7 seconds
```

### Remove Member

Removing a member with historical expenses uses a soft removal so existing expense calculations remain valid.

### Clear All

The clear dialog provides an option to:

**Download a backup before clearing.**

---

# ♿ Accessibility

Accessibility is built into the application rather than added as an afterthought.

Implemented features include:

- Accessible control names
- `aria-expanded`
- `aria-controls`
- Visible `:focus-visible` indicators
- Touch targets of at least 44px on touch devices
- Keyboard-operable controls
- Escape-to-close dialogs
- Backdrop-to-close dialogs
- `aria-live` settlement announcements
- Semantic status indicators
- Colour-independent balance states

The interface uses:

```text
Symbol + Word + Colour
```

instead of relying on colour alone.

---

# 📱 Responsive Design

The desktop expense table automatically changes into mobile-friendly cards below **620px**.

```text
Desktop
┌─────────────────────────────────────────────┐
│ Date │ Expense │ Amount │ Paid By │ Split   │
└─────────────────────────────────────────────┘

                ↓

Mobile

┌─────────────────────────┐
│ Expense                 │
│ Auto fare               │
│                         │
│ Amount       ₹120       │
│ Paid by      Priya      │
│ Split        Priya      │
└─────────────────────────┘
```

No unnecessary sideways scrolling on mobile.

---

# 🎨 Design Philosophy

The interface follows a **ledger-inspired design**.

```text
┌───────────────────────────────────────┐
│ DATE       DESCRIPTION        AMOUNT  │
├───────────────────────────────────────┤
│ 06 AUG     Auto fare          ₹120    │
│ 06 AUG     Lunch              ₹450    │
│ 07 AUG     Hotel              ₹2,400  │
└───────────────────────────────────────┘
```

The visual language uses:

- Ruled rows
- Quiet grey chrome
- Tabular numerals
- Clear hierarchy
- Minimal decoration
- Semantic colours
- Large, readable amounts

### Colour is reserved for meaningful states such as:
---

| Status | Colour Sample | Common Name | Hex | Meaning |
|---|---|---|---|---|
| `+ Owed` | 🟩 | **Dark Green** | `#166534` | Positive — is owed money |
| `- Owes` | 🟥 | **Dark Red** | `#B91C1C` | Negative — owes money |
| `= Settled` | ⬛ | **Slate Gray** | `#475569` | Zero — settled |

---

# 🛠️ Correctness Improvements

This rewrite introduced several important correctness improvements.

### <u>No stale exports</u>

Results are recomputed from current application state whenever required.

Exports are generated fresh at click time.

### <u>One total definition</u>

The header total and settlement total use the same calculation logic.

Invalid or non-positive amounts are excluded consistently.

### <u>Editable participants</u>

Each expense has its own participant selection.

Members can be included or excluded independently for every expense.

### <u>Integer-paise arithmetic</u>

All stored and calculated money values use integer paise.

This prevents floating-point accumulation errors.

### <u>Persistent payer information</u>

Payer corrections are persisted rather than being silently changed during rendering.

### <u>Duplicate member protection</u>

Duplicate member names are rejected.

Re-adding a previously removed member reactivates the existing member rather than creating a duplicate.

### <u>Editable dates</u>

Every expense has an editable date and defaults to the current date.

---

# 📈 Usability Improvements

The application includes:

- Mobile-first expense cards
- Teaching-oriented empty state
- Always-visible running balances
- Per-expense `₹X each` hints
- Clipboard support
- WhatsApp sharing
- WhatsApp length warning/truncation
- Floating participant selector
- Outside-click handling
- Single-open dropdown behaviour
- Undoable imports
- Undoable deletions
- Backup and restore
- Balance stat tiles
- Settlement sign badges

---

# 🧩 Technology

Built entirely with standard web technologies:

| Technology | Purpose |
|---|---|
| **HTML5** | Structure & semantic markup |
| **CSS3** | Responsive ledger-inspired interface |
| **JavaScript** | State management & calculations |
| **localStorage** | Local data persistence |
| **GitHub Pages** | Static hosting |

### Dependencies

```text
Dependencies: 0
Build tools:  0
Backend:      0
Database:     0
Login:        0
```

---

# 📁 Project Structure

```text
Group-Payment-Traker/
│
├── index.html
├── style.css
├── script.js
└── README.md
```

| File | Purpose |
|---|---|
| `index.html` | Application structure and accessible markup |
| `style.css` | Ledger theme, light/dark mode, responsive cards, contrast |
| `script.js` | State management, migration, calculations, prorating, exports |
| `README.md` | Project documentation |

---

# 🚫 Deliberately Not Included

Some functionality was intentionally left out to keep the application focused.

### Exact-paise settlement transfers

Settlement transfers are rounded to whole rupees because practical cash/UPI payments generally don't require transferring fractions of a rupee.

Individual balances remain exact.

### Tabs / Routing / Settings

The application intentionally keeps its simple single-page information architecture.

### Automatic removal of v1 storage

The old `localStorage` key is retained after migration as a backup.

---

# 🤝 Contributing

Issues, suggestions and pull requests are welcome.

For bugs, include:

- what you expected
- what happened
- steps to reproduce
- browser/device details when relevant

---

# 🔗 Links

### 💻 GitHub Repository

**[View the source code →](https://github.com/mdrajaulkarim/Group-Payment-Traker)**

The live application is linked at the top of this README to avoid repeating the same link.

---

# 👨‍💻 Project

**Group Payment Tracker**

A privacy-first web application built for managing shared expenses and simplifying group expense management.

<p align="center">
  <br><br>
  <a href="https://mdrajaulkarim.github.io/Group-Payment-Traker/">
    🚀 <strong>Launch Group Payment Tracker</strong>
  </a>
  <br>
  <strong>💸 Track expenses. Split fairly. Settle simply.</strong>
  <br><br>
</p>

---
<center>© 2026 <strong>IndiProtoHub LLP</strong> — All rights reserved.</center>
