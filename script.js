/* =============================================================================
   GROUP PAYMENT TRACKER
   - No login, no server. All data lives in this browser's localStorage.
   - Money is stored as INTEGER PAISE end to end. Nothing is ever kept as a
     float, so totals reconcile exactly.
   - Splits are prorated: each expense defaults to the members active on its
     date, and that participant set is editable per row.
   - Results are computed live from state on every change, and every export is
     built fresh at click time — there is no cached summary that can go stale.
   ============================================================================= */

'use strict';

const KEY_V2 = 'gpt_state_v2';
const KEY_V1 = 'gpt_state_v1';

const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/* -------------------------------------------------------------------------
   State
   v2 shape:
   {
     version: 2,
     members:      [{ id, name, active }],
     transactions: [{ id, title, amountPaise:int|null, method:'Cash'|'UPI',
                      paidBy:id|null, participants:[id], date:'YYYY-MM-DD', createdAt:int }]
   }
   ------------------------------------------------------------------------- */
let state = loadState();
let settlementRevealed = false;   // becomes true after first Calculate (then stays live)

/* ---------- money + date helpers ---------- */
function fmtP(paise) { return inr2.format((paise || 0) / 100); }        // exact, 2dp
function fmtRupees(rupees) { return inr0.format(rupees || 0); }         // whole-rupee (settlements)
function toPaise(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
function paiseToInput(paise) { return paise == null ? '' : String(paise / 100); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- storage: load, validate, migrate ---------- */
function freshState() { return { version: 2, members: [], transactions: [] }; }

function loadState() {
  // 1) Prefer a v2 record. normalize() repairs partial/corrupt shapes rather
  //    than discarding whatever data is salvageable.
  const v2 = safeParse(localStorage.getItem(KEY_V2));
  if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
    return normalize(v2);
  }
  // 2) Otherwise migrate a v1 record if present (never discard it).
  const v1 = safeParse(localStorage.getItem(KEY_V1));
  if (v1 && typeof v1 === 'object' && Array.isArray(v1.members)) {
    const migrated = normalize(migrateV1(v1));
    persist(migrated);              // write v2; v1 key is left untouched as a backup
    return migrated;
  }
  // 3) Clean slate.
  return freshState();
}

function safeParse(raw) { try { return JSON.parse(raw); } catch (e) { return null; } }

function migrateV1(v1) {
  return {
    version: 2,
    members: (v1.members || []).map(m => ({
      id: m && m.id ? m.id : uid(),
      name: m && typeof m.name === 'string' ? m.name : 'Member',
      active: m && m.active === false ? false : true
    })),
    transactions: (v1.transactions || []).map(t => ({
      id: t && t.id ? t.id : uid(),
      title: t && typeof t.title === 'string' ? t.title : '',
      amountPaise: toPaise(t && t.amount),                 // v1 stored a rupee string
      method: t && t.method === 'UPI' ? 'UPI' : 'Cash',
      paidBy: t && t.paidBy ? t.paidBy : null,
      participants: t && Array.isArray(t.participants) ? t.participants.slice() : [],
      date: t && t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : todayStr(),
      createdAt: t && t.createdAt ? t.createdAt : Date.now()
    }))
  };
}

/* Coerce any loaded object into a well-formed, self-consistent v2 state so a
   partial/corrupted record can't crash rendering. */
function normalize(raw) {
  const members = (Array.isArray(raw.members) ? raw.members : [])
    .filter(m => m && typeof m === 'object')
    .map(m => ({ id: m.id || uid(), name: typeof m.name === 'string' ? m.name : 'Member', active: m.active !== false }));

  const ids = new Set(members.map(m => m.id));

  const transactions = (Array.isArray(raw.transactions) ? raw.transactions : [])
    .filter(t => t && typeof t === 'object')
    .map(t => {
      let amountPaise = null;
      if (typeof t.amountPaise === 'number' && Number.isFinite(t.amountPaise)) amountPaise = Math.round(t.amountPaise);
      else if (t.amount != null) amountPaise = toPaise(t.amount);   // tolerate a stray v1-style field

      const participants = (Array.isArray(t.participants) ? t.participants : []).filter(id => ids.has(id));
      let paidBy = ids.has(t.paidBy) ? t.paidBy : null;
      if (paidBy && !participants.includes(paidBy)) participants.push(paidBy); // payer must share
      if (!paidBy && participants.length) paidBy = participants[0];

      return {
        id: t.id || uid(),
        title: typeof t.title === 'string' ? t.title : '',
        amountPaise,
        method: t.method === 'UPI' ? 'UPI' : 'Cash',
        paidBy,
        participants,
        date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayStr(),
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now()
      };
    });

  return { version: 2, members, transactions };
}

function persist(s) { localStorage.setItem(KEY_V2, JSON.stringify(s)); }
function save() { persist(state); }

/* ---------- misc ---------- */
function activeMembers() { return state.members.filter(m => m.active); }
function memberById(id) { return state.members.find(m => m.id === id); }
function memberName(id) { const m = memberById(id); return m ? m.name : 'Unknown'; }
function txnLabel(t) { return (t.title || '').trim() || '(untitled)'; }

/* Tiny DOM builder */
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'value') node.value = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => { if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return node;
}

/* ---------- element refs ---------- */
const $ = id => document.getElementById(id);
const membersBtn = $('membersBtn');
const membersPanel = $('membersPanel');
const memberCountEl = $('memberCount');
const addMemberForm = $('addMemberForm');
const newMemberName = $('newMemberName');
const memberError = $('memberError');
const membersListEl = $('membersList');
const txnBody = $('txnBody');
const totalAmountEl = $('totalAmount');
const liveStrip = $('liveStrip');
const settlementEl = $('settlement');
const settleStatus = $('settleStatus');
const exportBar = $('exportBar');
const toastEl = $('toast');
const toastMsg = $('toastMsg');
const toastUndo = $('toastUndo');
const clearDialog = $('clearDialog');

/* =========================================================================
   MEMBERS
   ========================================================================= */
function addMember(name) {
  name = (name || '').replace(/\s+/g, ' ').trim();
  memberError.hidden = true;
  if (!name) return false;
  const lower = name.toLowerCase();

  // No duplicate active members — keeps names distinguishable everywhere.
  if (activeMembers().some(m => m.name.toLowerCase() === lower)) {
    memberError.textContent = `"${name}" is already a member.`;
    memberError.hidden = false;
    return false;
  }
  // Re-adding a previously removed member reactivates them (no duplicate row).
  const removed = state.members.find(m => !m.active && m.name.toLowerCase() === lower);
  if (removed) {
    removed.active = true;
    removed.name = name;
  } else {
    state.members.push({ id: uid(), name, active: true });
  }
  save();
  renderMembers();
  renderTransactions();   // new member becomes an option in each row's split menu
  refreshComputed();
  return true;
}

function removeMember(id) {
  const m = memberById(id);
  if (!m) return;
  const idx = state.members.indexOf(m);
  const referenced = state.transactions.some(t => t.paidBy === id || t.participants.includes(id));

  // Soft-remove if they have history (keeps splits balanced); hard-delete otherwise.
  const prev = { member: { ...m }, index: idx, referenced };
  if (referenced) m.active = false;
  else state.members = state.members.filter(x => x.id !== id);

  save();
  renderMembers();
  renderTransactions();   // BUG 1.9: refresh payer/split controls after removal
  refreshComputed();

  showToast(`Removed ${m.name}`, () => {
    const target = memberById(prev.member.id);
    if (referenced && target) target.active = true;                 // undo soft-remove
    else if (!referenced) state.members.splice(Math.min(prev.index, state.members.length), 0, prev.member);
    save(); renderMembers(); renderTransactions(); refreshComputed();
  });
}

function renderMembers() {
  const active = activeMembers();
  memberCountEl.textContent = active.length;
  membersListEl.innerHTML = '';
  if (active.length === 0) {
    membersListEl.appendChild(el('p', { class: 'muted small', text: 'No members yet — add someone on the left.' }));
    return;
  }
  active.forEach(m => {
    membersListEl.appendChild(
      el('div', { class: 'member-chip' },
        el('span', { text: m.name }),
        el('button', { class: 'chip-x', type: 'button', 'aria-label': 'Remove ' + m.name, onclick: () => removeMember(m.id) }, '✕')
      )
    );
  });
}

/* =========================================================================
   TRANSACTIONS
   ========================================================================= */
function addTransaction() {
  const active = activeMembers();
  if (active.length === 0) {
    openMembersPanel(true);
    newMemberName.focus();
    memberError.textContent = 'Add at least one member before recording an expense.';
    memberError.hidden = false;
    return;
  }
  state.transactions.push({
    id: uid(), title: '', amountPaise: null, method: 'Cash',
    paidBy: active[0].id, participants: active.map(m => m.id),
    date: todayStr(), createdAt: Date.now()
  });
  save();
  renderTransactions();
  refreshComputed();
  const rows = txnBody.querySelectorAll('.txn-row');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('input[type="text"]').focus();
}

function deleteTransaction(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx < 0) return;
  const removed = state.transactions[idx];
  state.transactions.splice(idx, 1);
  save();
  renderTransactions();
  refreshComputed();
  showToast(`Deleted "${txnLabel(removed)}"`, () => {
    state.transactions.splice(Math.min(idx, state.transactions.length), 0, removed);
    save(); renderTransactions(); refreshComputed();
  });
}

/* Options for "Paid by" = this row's participants only (a late joiner can't have
   paid an earlier bill). Returns the resolved payer id after any correction. */
function fillPayerSelect(sel, txn) {
  sel.innerHTML = '';
  const ids = txn.participants.filter(id => memberById(id));
  ids.forEach(id => {
    const m = memberById(id);
    sel.appendChild(el('option', { value: id, text: m.active ? m.name : m.name + ' (removed)' }));
  });
  if (!ids.includes(txn.paidBy)) txn.paidBy = ids[0] || null;   // caller persists
  sel.value = txn.paidBy || '';
  sel.disabled = ids.length === 0;
}

function renderRow(txn) {
  const tr = el('tr', { class: 'txn-row', 'data-id': txn.id });
  const refs = {};

  /* Date */
  const dateInput = el('input', {
    type: 'date', class: 'cell-input num', 'aria-label': 'Date', value: txn.date,
    oninput: e => { txn.date = e.target.value || todayStr(); save(); refreshComputed(); }
  });

  /* Title */
  const titleInput = el('input', {
    type: 'text', class: 'cell-input', 'aria-label': 'Title', placeholder: 'e.g. Auto fare', value: txn.title || '',
    oninput: e => { txn.title = e.target.value; save(); updateRowDerived(txn, tr); refreshComputed(); }
  });

  /* Amount (step="any" so arrow keys don't jump by a fixed coarse amount) */
  const amountInput = el('input', {
    type: 'number', min: '0', step: 'any', inputmode: 'decimal', class: 'cell-input num',
    'aria-label': 'Amount in rupees', placeholder: '0.00', value: paiseToInput(txn.amountPaise),
    oninput: e => { txn.amountPaise = toPaise(e.target.value); save(); updateRowDerived(txn, tr); refreshComputed(); }
  });

  /* Method */
  const methodSel = el('select', { class: 'cell-input', 'aria-label': 'Payment method',
    onchange: e => { txn.method = e.target.value; save(); } },
    el('option', { value: 'Cash', text: 'Cash' }),
    el('option', { value: 'UPI', text: 'UPI' })
  );
  methodSel.value = txn.method || 'Cash';

  /* Paid by */
  const payerSel = el('select', { class: 'cell-input', 'aria-label': 'Who paid',
    onchange: e => { txn.paidBy = e.target.value; save(); refreshComputed(); } });
  fillPayerSelect(payerSel, txn);

  /* Split-between: a floating dropdown menu of checkboxes; chosen names stay
     visible in the summary so selection is never hidden (BUG 1.3 + 1.5). */
  const splitLabel = el('span', { class: 'split-label' });
  const splitSummary = el('summary', { class: 'split-summary', 'aria-label': 'Choose who splits this expense' },
    splitLabel, el('span', { class: 'caret', 'aria-hidden': 'true' }, '▾'));
  const splitMenu = el('div', { class: 'split-menu', role: 'group', 'aria-label': 'Split between' });
  const splitDd = el('details', { class: 'split-dd' }, splitSummary, splitMenu);
  splitDd._txn = txn;
  splitSummary.addEventListener('click', e => {
    if (splitDd.open) {
      // trying to collapse — block while nobody is selected
      if (txn.participants.length === 0) { e.preventDefault(); flashSplitEmpty(splitDd); }
    } else {
      closeOtherSplits(splitDd);   // only one split menu open at a time
    }
  });
  splitDd.addEventListener('toggle', () => { if (splitDd.open) { closeOtherSplits(splitDd); positionSplitMenu(splitDd); } });
  refs.splitMenu = splitMenu;
  refs.splitLabel = splitLabel;
  refs.splitDd = splitDd;

  /* Per-row derived note (each-share / validity) */
  const note = el('p', { class: 'row-note' });
  refs.note = note;
  const splitCol = el('div', { class: 'split-col' }, splitDd, note);

  /* Actions: delete — two-step, self-cancelling after 3 seconds */
  let confirmTimer = null;
  const delBtn = el('button', { class: 'btn-icon danger', type: 'button', 'aria-label': 'Delete this expense', title: 'Delete' }, '✕');
  const resetDel = () => {
    clearTimeout(confirmTimer); confirmTimer = null;
    delBtn.classList.remove('confirm');
    delBtn.setAttribute('aria-label', 'Delete this expense');
    delBtn.title = 'Delete';
  };
  delBtn.addEventListener('click', () => {
    if (confirmTimer) { resetDel(); deleteTransaction(txn.id); return; }   // 2nd click within 3s → delete
    delBtn.classList.add('confirm');
    delBtn.setAttribute('aria-label', 'Click again within 3 seconds to confirm delete');
    delBtn.title = 'Click again to confirm';
    showToast(`Delete "${txnLabel(txn)}"? Click ✕ again to confirm.`, null, 3000);   // visible message
    confirmTimer = setTimeout(resetDel, 3000);
  });

  tr.append(
    el('td', { 'data-label': 'Date' }, dateInput),
    el('td', { 'data-label': 'Title' }, titleInput),
    el('td', { 'data-label': 'Amount', class: 'cell-amt' }, amountInput),
    el('td', { 'data-label': 'Method' }, methodSel),
    el('td', { 'data-label': 'Paid by' }, payerSel),
    el('td', { 'data-label': 'Split', class: 'cell-split' }, splitCol),
    el('td', { 'data-label': '', class: 'cell-act' }, el('div', { class: 'row-actions' }, delBtn))
  );

  tr._refs = refs;
  buildSplitMenu(splitMenu, txn, tr);
  updateSplitSummary(txn, tr);
  updateRowDerived(txn, tr);
  return tr;
}

/* Build the checkbox list inside the split dropdown. Every member that is active
   OR already part of this expense is selectable. */
function buildSplitMenu(menuEl, txn, tr) {
  menuEl.innerHTML = '';
  const pool = state.members.filter(m => m.active || txn.participants.includes(m.id));
  if (pool.length === 0) { menuEl.appendChild(el('p', { class: 'muted small', text: 'No members yet.' })); return; }

  menuEl.appendChild(el('div', { class: 'split-menu-head' },
    el('span', { class: 'lbl', text: 'Split between' }),
    el('div', { class: 'split-menu-actions' },
      el('button', { type: 'button', class: 'split-mini', onclick: () => setAllParticipants(txn, tr, pool.map(m => m.id)) }, 'All'),
      el('button', { type: 'button', class: 'split-mini', onclick: () => setAllParticipants(txn, tr, []) }, 'Clear')
    )
  ));

  pool.forEach(m => {
    const cb = el('input', { type: 'checkbox', 'aria-label': m.name + (m.active ? '' : ' (removed)') });
    cb.checked = txn.participants.includes(m.id);
    cb.addEventListener('change', () => setParticipant(txn, m.id, cb.checked, tr));
    menuEl.appendChild(el('label', { class: 'split-opt' }, cb,
      el('span', {}, m.name, m.active ? null : el('span', { class: 'removed', text: ' (removed)' }))));
  });
}

function setParticipant(txn, memberId, on, tr) {
  const i = txn.participants.indexOf(memberId);
  if (on && i < 0) txn.participants.push(memberId);
  else if (!on && i >= 0) txn.participants.splice(i, 1);
  keepPayerValid(txn);
  save();
  syncRowSplit(txn, tr);   // updates summary + payer select + note (no menu rebuild → keeps focus)
  refreshComputed();
}

function setAllParticipants(txn, tr, ids) {
  txn.participants = ids.slice();
  keepPayerValid(txn);
  save();
  buildSplitMenu(tr._refs.splitMenu, txn, tr);   // rebuild so every checkbox reflects the new state
  syncRowSplit(txn, tr);
  if (tr._refs.splitDd.open) positionSplitMenu(tr._refs.splitDd);  // height changed
  refreshComputed();
}

function keepPayerValid(txn) {
  if (!txn.participants.includes(txn.paidBy)) txn.paidBy = txn.participants[0] || null;
}

function syncRowSplit(txn, tr) {
  updateSplitSummary(txn, tr);
  const payerSel = tr.querySelector('td[data-label="Paid by"] select');
  if (payerSel) fillPayerSelect(payerSel, txn);
  updateRowDerived(txn, tr);
}

function updateSplitSummary(txn, tr) {
  const label = tr._refs.splitLabel;
  const names = txn.participants.map(id => memberById(id)).filter(Boolean).map(m => m.name);
  const activeCount = activeMembers().length;
  const empty = names.length === 0;
  tr._refs.splitDd.classList.toggle('invalid', empty);
  if (empty) {
    label.textContent = 'Select members';
    label.classList.add('empty');
  } else {
    label.classList.remove('empty');
    label.textContent = (names.length >= 2 && names.length === activeCount) ? `Everyone (${names.length})` : names.join(', ');
  }
}

/* ---- floating menu placement + close-on-outside-click (with empty guard) ---- */
function positionSplitMenu(dd) {
  const sum = dd.querySelector('.split-summary');
  const menu = dd.querySelector('.split-menu');
  if (!sum || !menu) return;
  const r = sum.getBoundingClientRect();
  // At least readable width, but never wider than the viewport.
  const width = Math.min(Math.max(r.width, 210), window.innerWidth - 16);
  menu.style.width = width + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) + 'px';
  const spaceBelow = window.innerHeight - r.bottom;
  const spaceAbove = r.top;
  if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.bottom = 'auto';
    menu.style.maxHeight = Math.max(140, spaceBelow - 16) + 'px';
  } else {
    menu.style.top = 'auto';
    menu.style.bottom = (window.innerHeight - r.top + 6) + 'px';
    menu.style.maxHeight = Math.max(140, spaceAbove - 16) + 'px';
  }
}

function repositionOpenSplit() {
  document.querySelectorAll('.split-dd[open]').forEach(positionSplitMenu);
}

/* Only one split dropdown open at a time (blocks multiple floating menus). */
function closeOtherSplits(except) {
  document.querySelectorAll('.split-dd[open]').forEach(dd => { if (dd !== except) dd.open = false; });
}

function flashSplitEmpty(dd) {
  dd.classList.add('invalid');
  const sum = dd.querySelector('.split-summary');
  if (sum) sum.focus();
  dd.classList.remove('shake'); void dd.offsetWidth; dd.classList.add('shake');
  setTimeout(() => dd.classList.remove('shake'), 350);
}

function onDocClickCloseSplit(e) {
  document.querySelectorAll('.split-dd[open]').forEach(dd => {
    if (dd.contains(e.target)) return;                                  // clicking inside keeps it open
    if (dd._txn && dd._txn.participants.length === 0) { flashSplitEmpty(dd); return; } // must pick someone
    dd.open = false;
  });
}

function onSplitEsc(e) {
  if (e.key !== 'Escape') return;
  const open = document.querySelectorAll('.split-dd[open]');
  if (!open.length) return;
  open.forEach(dd => { if (dd._txn && dd._txn.participants.length === 0) flashSplitEmpty(dd); else dd.open = false; });
}

/* Per-row validity + "each pays" hint. Updates in place; never rebuilds inputs. */
function updateRowDerived(txn, tr) {
  const note = tr._refs.note;
  const parts = txn.participants.filter(id => memberById(id));
  const amt = txn.amountPaise;

  let invalid = false, msg = '';
  if (amt == null) { msg = ''; }                                  // just incomplete, not an error
  else if (amt <= 0) { invalid = true; msg = 'Amount must be greater than ₹0 — this row is excluded.'; }
  else if (parts.length === 0) { invalid = true; msg = 'Select at least one person — this row is excluded.'; }
  else {
    const base = Math.floor(amt / parts.length);
    const rem = amt - base * parts.length;
    let hint = `${fmtP(base)} each · ${parts.length} ${parts.length === 1 ? 'person' : 'people'}`;
    if (rem > 0) {
      const absorber = parts.includes(txn.paidBy) ? txn.paidBy : parts[0];
      hint += ` · ${memberName(absorber)} covers +${fmtP(rem)}`;
    }
    if (!txn.title.trim()) hint += ' · no title yet';
    msg = hint;
  }
  note.textContent = msg;
  note.className = 'row-note' + (invalid ? ' error' : '');
  tr.classList.toggle('row-invalid', invalid);
}

function renderTransactions() {
  txnBody.innerHTML = '';
  if (state.transactions.length === 0) {
    const cell = el('td', { colspan: '7' },
      el('div', { class: 'empty-state' },
        el('p', {}, el('strong', { text: 'No expenses yet.' })),
        el('ol', {},
          el('li', { text: 'Open Members and add everyone in the group.' }),
          el('li', { text: 'Add an expense: title, amount, who paid.' }),
          el('li', { text: 'Tick who shares each expense (added members join from their date).' }),
          el('li', { text: 'Hit Calculate to see who owes whom.' })
        )
      )
    );
    txnBody.appendChild(el('tr', { class: 'empty-row' }, cell));
    return;
  }
  state.transactions.forEach(t => txnBody.appendChild(renderRow(t)));
}

/* =========================================================================
   CALCULATION — one total, integer paise, deterministic rounding
   ========================================================================= */
function computeSettlement() {
  const acc = {};
  state.members.forEach(m => { acc[m.id] = { id: m.id, name: m.name, active: m.active, paidP: 0, shareP: 0 }; });

  let totalP = 0;
  const excluded = [];   // {title, reason}
  const untitled = [];   // titles of included-but-untitled rows
  const remainders = []; // {name, title, paise}

  state.transactions.forEach(t => {
    const amt = t.amountPaise;
    const parts = (t.participants || []).filter(id => acc[id]);

    if (amt == null) { excluded.push({ title: txnLabel(t), reason: 'no amount entered' }); return; }
    if (amt <= 0) { excluded.push({ title: txnLabel(t), reason: 'amount is not greater than ₹0' }); return; }
    if (parts.length === 0) { excluded.push({ title: txnLabel(t), reason: 'nobody selected to split' }); return; }

    totalP += amt;
    if (!t.title.trim()) untitled.push(txnLabel(t));

    // Split in whole paise; assign the indivisible remainder to ONE participant
    // (the payer if they share, else the first participant) so shares sum EXACTLY.
    const base = Math.floor(amt / parts.length);
    const rem = amt - base * parts.length;
    parts.forEach(id => { acc[id].shareP += base; });
    if (rem > 0) {
      const absorber = parts.includes(t.paidBy) ? t.paidBy : parts[0];
      acc[absorber].shareP += rem;
      remainders.push({ name: acc[absorber].name, title: txnLabel(t), paise: rem });
    }
    if (acc[t.paidBy]) acc[t.paidBy].paidP += amt;
  });

  const rows = Object.values(acc)
    .map(r => ({ ...r, balanceP: r.paidP - r.shareP }))
    .filter(r => r.active || r.paidP !== 0 || r.shareP !== 0)
    .sort((a, b) => b.balanceP - a.balanceP || a.name.localeCompare(b.name));

  return { rows, totalP, excluded, untitled, remainders };
}

/* Who-pays-whom, rounded to whole rupees (people settle in notes, not paise). */
function suggestSettlements(rows) {
  const arr = rows.map(r => ({ name: r.name, rupee: Math.round(r.balanceP / 100) }));
  // Rounding can leave a small residual; nudge ±1 until the set sums to zero.
  let residual = arr.reduce((s, x) => s + x.rupee, 0);
  const order = arr.slice().sort((a, b) => Math.abs(b.rupee) - Math.abs(a.rupee));
  let i = 0;
  while (residual !== 0 && order.length) {
    const step = residual > 0 ? -1 : 1;
    order[i % order.length].rupee += step;
    residual += step;
    i++;
  }
  const debtors = arr.filter(x => x.rupee < 0).map(x => ({ name: x.name, amt: -x.rupee })).sort((a, b) => b.amt - a.amt);
  const creditors = arr.filter(x => x.rupee > 0).map(x => ({ name: x.name, amt: x.rupee })).sort((a, b) => b.amt - a.amt);

  const out = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].amt, creditors[c].amt);
    if (pay > 0) out.push({ from: debtors[d].name, to: creditors[c].name, rupee: pay });
    debtors[d].amt -= pay; creditors[c].amt -= pay;
    if (debtors[d].amt === 0) d++;
    if (creditors[c].amt === 0) c++;
  }
  return out;
}

/* =========================================================================
   LIVE RENDER — total, running balances, and (once revealed) settlement.
   Called after EVERY mutation, so nothing on screen or in exports is stale.
   ========================================================================= */
function refreshComputed() {
  const data = computeSettlement();
  totalAmountEl.textContent = fmtP(data.totalP);      // single source of truth for the total
  renderLiveStrip(data);
  if (settlementRevealed) renderSettlement(data);
  updateExportVisibility(data);
}

function renderLiveStrip(data) {
  liveStrip.innerHTML = '';
  if (data.rows.length === 0 || data.totalP === 0) {
    liveStrip.appendChild(el('p', { class: 'muted small', text: 'Add members and expenses to see running balances here.' }));
    return;
  }
  data.rows.forEach(r => {
    let cls = 'settled', word = 'settled', amt = '—';
    if (r.balanceP > 0) { cls = 'owed'; word = 'gets back'; amt = fmtP(r.balanceP); }
    else if (r.balanceP < 0) { cls = 'owe'; word = 'owes'; amt = fmtP(-r.balanceP); }
    liveStrip.appendChild(
      el('div', { class: 'live-chip ' + cls },
        el('span', { class: 'nm' }, r.name, r.active ? null : el('span', { class: 'pill', text: 'removed' })),
        el('span', { class: 'amt num', text: amt }),
        el('span', { class: 'word', text: word })
      )
    );
  });
}

function renderSettlement(data) {
  settlementEl.hidden = false;
  settlementEl.className = 'settlement show';
  // rebuild everything except the aria-live status node
  [...settlementEl.children].forEach(n => { if (n.id !== 'settleStatus') n.remove(); });

  if (data.rows.length === 0 || data.totalP === 0) {
    settlementEl.appendChild(el('p', { class: 'muted', text: 'Nothing to settle yet — add members and at least one expense with a positive amount.' }));
    return;
  }

  const settlements = suggestSettlements(data.rows);

  settlementEl.appendChild(
    el('div', { class: 'result-head' },
      el('h2', { text: 'Settlement' }),
      el('span', { class: 'muted small num', text: 'Total ' + fmtP(data.totalP) + ' · ' + data.rows.length + ' member(s)' })
    )
  );

  /* Balances — colour + sign + word (survives greyscale, BUG 1.7) */
  const list = el('div', { class: 'balance-list' });
  data.rows.forEach(r => {
    let tag;
    if (r.balanceP > 0) tag = balanceTag('owed', '+', 'gets back', fmtP(r.balanceP));
    else if (r.balanceP < 0) tag = balanceTag('owe', '−', 'owes', fmtP(-r.balanceP));
    else tag = balanceTag('settled', '=', 'settled up', '');

    const who = el('span', { class: 'who' }, r.name, r.active ? null : el('span', { class: 'pill', text: 'removed' }));
    list.appendChild(
      el('div', { class: 'balance-row' },
        el('div', {}, who, el('div', { class: 'detail num', text: 'paid ' + fmtP(r.paidP) + ' · owes share ' + fmtP(r.shareP) })),
        tag
      )
    );
  });
  settlementEl.appendChild(list);

  /* Who pays whom (whole rupees) */
  const block = el('div', { class: 'settle-block' }, el('h3', { text: 'Who pays whom' }));
  if (settlements.length === 0) {
    block.appendChild(el('div', { class: 'all-settled', text: 'Everyone is settled up.' }));
  } else {
    const sl = el('div', { class: 'settle-list' });
    settlements.forEach(s => sl.appendChild(
      el('div', { class: 'settle-item num' }, el('b', { text: s.from }), ' pays ', el('b', { text: s.to }), ' ' + fmtRupees(s.rupee))
    ));
    block.appendChild(sl);
    block.appendChild(el('p', { class: 'muted small', text: 'Transfers are rounded to the nearest ₹1 for easy cash/UPI payment; per-person balances above are exact.' }));
  }
  settlementEl.appendChild(block);

  /* Notes: excluded rows, untitled rows, rounding absorbers */
  const notes = el('div', { class: 'notes' });
  if (data.excluded.length) {
    notes.appendChild(el('div', { class: 'note warn' },
      el('b', { text: `${data.excluded.length} row(s) excluded: ` }),
      data.excluded.map(x => `${x.title} (${x.reason})`).join('; ')));
  }
  if (data.untitled.length) {
    notes.appendChild(el('div', { class: 'note' },
      el('b', { text: `${data.untitled.length} expense(s) have no title` }), ' — included, but consider naming them.'));
  }
  if (data.remainders.length) {
    notes.appendChild(el('div', { class: 'note' },
      el('b', { text: 'Uneven splits: ' }),
      data.remainders.map(x => `${x.name} absorbed +${fmtP(x.paise)} on "${x.title}"`).join('; '), '.'));
  }
  if (notes.children.length) settlementEl.appendChild(notes);
  // Note: the aria-live announcement is set by calculate(), not here, so live
  // edits update the visible panel without spamming screen readers.
}

function balanceTag(cls, sign, word, amount) {
  return el('span', { class: 'tag ' + cls },
    el('span', { class: 'sign', 'aria-hidden': 'true', text: sign }),
    el('span', { class: 'tag-body' },
      el('span', { class: 'tag-word', text: word }),
      amount ? el('span', { class: 'tag-amt num', text: amount }) : null
    )
  );
}

function updateExportVisibility(data) {
  exportBar.hidden = !(settlementRevealed && data.rows.length > 0 && data.totalP > 0);
}

function calculate() {
  settlementRevealed = true;
  refreshComputed();
  // Announce once, on demand — not on every keystroke of a live edit.
  const data = computeSettlement();
  if (data.rows.length && data.totalP > 0) {
    const n = suggestSettlements(data.rows).length;
    settleStatus.textContent = `Settlement ready. Total ${fmtP(data.totalP)}. ` +
      (n ? `${n} payment(s) suggested.` : 'Everyone is settled.');
  } else {
    settleStatus.textContent = 'Nothing to settle yet — add members and an expense with a positive amount.';
  }
  settlementEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
}

/* =========================================================================
   EXPORT — always built fresh from current state (no stale cache, BUG 1.1)
   ========================================================================= */
function buildSummaryText() {
  const data = computeSettlement();
  const settlements = suggestSettlements(data.rows);
  const L = [];
  L.push('GROUP PAYMENT TRACKER — SETTLEMENT');
  L.push('Generated: ' + new Date().toLocaleString());
  L.push('');
  L.push('Total expenses: ' + fmtP(data.totalP));
  L.push('Members: ' + (data.rows.map(r => r.name + (r.active ? '' : ' (removed)')).join(', ') || '—'));
  L.push('');
  L.push('BALANCES');
  if (!data.rows.length) L.push('• (nothing yet)');
  data.rows.forEach(r => {
    const status = r.balanceP > 0 ? 'gets back ' + fmtP(r.balanceP)
      : r.balanceP < 0 ? 'owes ' + fmtP(-r.balanceP) : 'settled up';
    L.push(`• ${r.name} — paid ${fmtP(r.paidP)}, share ${fmtP(r.shareP)} → ${status}`);
  });
  L.push('');
  L.push('WHO PAYS WHOM (rounded to ₹1)');
  if (!settlements.length) L.push('• Everyone is settled up.');
  settlements.forEach(s => L.push(`• ${s.from} pays ${s.to} ${fmtRupees(s.rupee)}`));
  if (data.excluded.length) {
    L.push('');
    L.push('EXCLUDED ROWS');
    data.excluded.forEach(x => L.push(`• ${x.title} — ${x.reason}`));
  }
  L.push('');
  L.push('— Group Payment Tracker');
  return L.join('\n');
}

function downloadTxt() {
  const blob = new Blob([buildSummaryText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: 'settlement.txt' });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function copySummary() {
  const text = buildSummaryText();
  try {
    await navigator.clipboard.writeText(text);
    flashButton($('copyBtn'), 'Copied ✓');
  } catch (e) {
    const ta = el('textarea', { value: text, 'aria-hidden': 'true' });
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); flashButton($('copyBtn'), 'Copied ✓'); }
    catch (_) { flashButton($('copyBtn'), 'Copy failed'); }
    ta.remove();
  }
}

function shareWhatsApp() {
  let text = buildSummaryText();
  // wa.me carries text in the URL; very long summaries can be truncated by clients.
  const LIMIT = 1500;
  if (text.length > LIMIT) {
    if (!confirm('This summary is long and WhatsApp may cut it off. Share a shortened version?')) return;
    text = text.slice(0, LIMIT - 20) + '\n… (truncated)';
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

function flashButton(btn, msg) {
  if (!btn) return;
  if (btn._flashTimer) clearTimeout(btn._flashTimer);   // rapid re-clicks keep the true label
  else btn._orig = btn.textContent;
  btn.textContent = msg;
  btn._flashTimer = setTimeout(() => { btn.textContent = btn._orig; btn._flashTimer = null; }, 1400);
}

/* =========================================================================
   BACKUP / RESTORE — the whole state as a JSON file. Import is undoable.
   ========================================================================= */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `group-payments-backup-${todayStr()}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const obj = safeParse(reader.result);
    const looksValid = obj && typeof obj === 'object' && (Array.isArray(obj.members) || Array.isArray(obj.transactions));
    if (!looksValid) { showToast('That file is not a valid backup.', null, 4000); return; }
    const prev = JSON.parse(JSON.stringify(state));          // snapshot for undo
    state = normalize(obj);                                  // repairs/validates the imported data
    save();
    settlementRevealed = false; settlementEl.hidden = true; exportBar.hidden = true;
    renderAll();
    showToast('Backup imported — replaced current data.', () => { state = normalize(prev); save(); renderAll(); }, 9000);
  };
  reader.onerror = () => showToast('Could not read that file.', null, 4000);
  reader.readAsText(file);
}

/* =========================================================================
   CLEAR (with export-first + undo-safe copy)
   ========================================================================= */
function openClearDialog() {
  if (state.members.length === 0 && state.transactions.length === 0) return;
  clearDialog.hidden = false;
  $('clearConfirm').focus();
  document.addEventListener('keydown', clearDialogKey);
}
function closeClearDialog() {
  clearDialog.hidden = true;
  document.removeEventListener('keydown', clearDialogKey);
  $('clearBtn').focus();
}
function clearDialogKey(e) { if (e.key === 'Escape') closeClearDialog(); }

function doClear() {
  localStorage.removeItem(KEY_V2);
  // v1 backup is intentionally left in place; nothing is silently destroyed.
  state = freshState();
  settlementRevealed = false;
  settlementEl.hidden = true;
  exportBar.hidden = true;
  renderAll();
  closeClearDialog();
}

/* =========================================================================
   TOAST (undo)
   ========================================================================= */
let toastTimer = null;
let pendingUndo = null;
function showToast(message, undoFn, duration = 7000) {
  clearTimeout(toastTimer);
  pendingUndo = undoFn || null;
  toastMsg.textContent = message;
  toastUndo.hidden = !undoFn;          // message-only toast (e.g. the delete prompt) has no Undo button
  toastEl.hidden = false;
  toastTimer = setTimeout(hideToast, duration);
}
function hideToast() { toastEl.hidden = true; pendingUndo = null; }
function runUndo() { if (pendingUndo) { const fn = pendingUndo; hideToast(); fn(); } }

/* =========================================================================
   PANEL + WIRING
   ========================================================================= */
function openMembersPanel(open) {
  const willOpen = open === undefined ? membersPanel.hidden : open;
  membersPanel.hidden = !willOpen;
  membersBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function renderAll() {
  renderMembers();
  renderTransactions();
  refreshComputed();
}

function init() {
  membersBtn.addEventListener('click', () => openMembersPanel());
  addMemberForm.addEventListener('submit', e => {
    e.preventDefault();
    if (addMember(newMemberName.value)) { newMemberName.value = ''; }
    newMemberName.focus();
  });
  newMemberName.addEventListener('input', () => { memberError.hidden = true; });

  $('addTxnBtn').addEventListener('click', addTransaction);
  $('addTxnBtn2').addEventListener('click', addTransaction);
  $('calcBtn').addEventListener('click', calculate);

  $('clearBtn').addEventListener('click', openClearDialog);
  $('clearCancel').addEventListener('click', closeClearDialog);
  $('clearConfirm').addEventListener('click', doClear);
  $('clearExport').addEventListener('click', () => { downloadTxt(); });
  clearDialog.addEventListener('click', e => { if (e.target === clearDialog) closeClearDialog(); });

  $('copyBtn').addEventListener('click', copySummary);
  $('exportTxtBtn').addEventListener('click', downloadTxt);
  $('whatsappBtn').addEventListener('click', shareWhatsApp);

  $('backupBtn').addEventListener('click', exportData);
  $('restoreBtn').addEventListener('click', () => $('restoreFile').click());
  $('restoreFile').addEventListener('change', e => { importData(e.target.files[0]); e.target.value = ''; });

  toastUndo.addEventListener('click', runUndo);

  // Split dropdown: close on outside click / Escape (unless nothing is selected),
  // and keep the floating menu aligned to its field while scrolling/resizing.
  document.addEventListener('click', onDocClickCloseSplit);
  document.addEventListener('keydown', onSplitEsc);
  window.addEventListener('scroll', repositionOpenSplit, { capture: true, passive: true });
  window.addEventListener('resize', repositionOpenSplit);

  renderAll();
  // (No auto-open of the Members panel: the empty-state instructions already guide
  // first-time users, and skipping it avoids a post-load layout shift / CLS.)
}

init();
