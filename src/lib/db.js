import { openDB } from 'idb'

const DB_NAME = 'lifesoc'
const DB_VERSION = 1

const DOMAIN_DEFAULTS = [
  { id: 'relationships', label: 'Relationships', icon: '🤝', score: 5, notes: '', history: [], updatedAt: null },
  { id: 'finances',      label: 'Finances',      icon: '💰', score: 5, notes: '', history: [], updatedAt: null },
  { id: 'career',        label: 'Career',         icon: '🧭', score: 5, notes: '', history: [], updatedAt: null },
  { id: 'health',        label: 'Health',         icon: '❤️', score: 5, notes: '', history: [], updatedAt: null },
  { id: 'reputation',    label: 'Reputation',     icon: '🔑', score: 5, notes: '', history: [], updatedAt: null },
  { id: 'mental',        label: 'Mental',         icon: '🧠', score: 5, notes: '', history: [], updatedAt: null }
]

export { DOMAIN_DEFAULTS }

let _db

async function db() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('domains'))  d.createObjectStore('domains',  { keyPath: 'id' })
        if (!d.objectStoreNames.contains('cves'))     d.createObjectStore('cves',     { keyPath: 'id' })
        if (!d.objectStoreNames.contains('patches'))  d.createObjectStore('patches',  { keyPath: 'id' })
        if (!d.objectStoreNames.contains('incidents'))d.createObjectStore('incidents',{ keyPath: 'id' })
        if (!d.objectStoreNames.contains('scans'))    d.createObjectStore('scans',    { keyPath: 'id' })
        if (!d.objectStoreNames.contains('messages')) d.createObjectStore('messages', { keyPath: 'id' })
      }
    })
  }
  return _db
}

function uid() { return crypto.randomUUID() }
function now() { return new Date().toISOString() }

// ── DOMAINS ──────────────────────────────────────────────────────────────────

export async function getDomains() {
  const d = await db()
  const stored = await d.getAll('domains')
  const map = Object.fromEntries(stored.map(s => [s.id, s]))
  return DOMAIN_DEFAULTS.map(def => map[def.id] ?? def)
}

export async function updateDomain(id, score, notes = '') {
  const d = await db()
  const existing = (await d.get('domains', id)) ?? DOMAIN_DEFAULTS.find(x => x.id === id)
  const history = [...(existing.history ?? []), { score: existing.score, date: existing.updatedAt ?? now() }].slice(-30)
  const updated = { ...existing, score, notes, history, updatedAt: now() }
  await d.put('domains', updated)
  return updated
}

// ── CVEs ─────────────────────────────────────────────────────────────────────

export async function getCVEs() {
  const d = await db()
  const all = await d.getAll('cves')
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function saveCVE(data) {
  const d = await db()
  const entry = data.id
    ? { ...(await d.get('cves', data.id)), ...data, updatedAt: now() }
    : { id: uid(), createdAt: now(), updatedAt: now(), ...data }
  await d.put('cves', entry)
  return entry
}

export async function deleteCVE(id) { (await db()).delete('cves', id) }

// ── PATCHES ───────────────────────────────────────────────────────────────────

export async function getPatches() {
  const d = await db()
  const all = await d.getAll('patches')
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function savePatch(data) {
  const d = await db()
  const entry = data.id
    ? { ...(await d.get('patches', data.id)), ...data, updatedAt: now() }
    : { id: uid(), createdAt: now(), updatedAt: now(), checkIns: [], ...data }
  await d.put('patches', entry)
  return entry
}

export async function addCheckIn(patchId, note) {
  const d = await db()
  const patch = await d.get('patches', patchId)
  patch.checkIns = [...(patch.checkIns ?? []), { id: uid(), note, date: now() }]
  patch.updatedAt = now()
  await d.put('patches', patch)
  return patch
}

export async function deletePatch(id) { (await db()).delete('patches', id) }

// ── INCIDENTS ─────────────────────────────────────────────────────────────────

const EMPTY_PHASES = () => ({
  identification: { notes: '', completedAt: null },
  containment:    { notes: '', completedAt: null },
  eradication:    { notes: '', completedAt: null },
  recovery:       { notes: '', completedAt: null },
  pir:            { notes: '', completedAt: null }
})

export async function getIncidents() {
  const d = await db()
  const all = await d.getAll('incidents')
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function saveIncident(data) {
  const d = await db()
  const entry = data.id
    ? { ...(await d.get('incidents', data.id)), ...data, updatedAt: now() }
    : { id: uid(), createdAt: now(), updatedAt: now(), status: 'active', phases: EMPTY_PHASES(), ...data }
  await d.put('incidents', entry)
  return entry
}

export async function updatePhase(incidentId, phase, notes, completed = false) {
  const d = await db()
  const incident = await d.get('incidents', incidentId)
  incident.phases[phase] = { notes, completedAt: completed ? now() : null }
  incident.updatedAt = now()
  await d.put('incidents', incident)
  return incident
}

export async function deleteIncident(id) { (await db()).delete('incidents', id) }

// ── SCANS ─────────────────────────────────────────────────────────────────────

export async function getScans() {
  const d = await db()
  const all = await d.getAll('scans')
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function saveScan(input, result) {
  const d = await db()
  const entry = { id: uid(), input, ...result, createdAt: now() }
  await d.put('scans', entry)
  return entry
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────

export async function getMessages() {
  const d = await db()
  return (await d.getAll('messages')).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

export async function saveMessage(role, content) {
  const d = await db()
  const entry = { id: uid(), role, content, timestamp: now() }
  await d.put('messages', entry)
  return entry
}

export async function clearMessages() {
  const d = await db()
  const all = await d.getAll('messages')
  await Promise.all(all.map(m => d.delete('messages', m.id)))
}
