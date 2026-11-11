const PREFIX = 'gun_draft_'
const TS_SUFFIX = '_ts'

export const saveDraft = (draftData, draftId = 'create') => {
  try {
    const key = `${PREFIX}${draftId}`
    const ts = new Date().toISOString()
    localStorage.setItem(key, JSON.stringify({ ...draftData, savedAt: ts }))
    localStorage.setItem(`${key}${TS_SUFFIX}`, ts)
    return true
  } catch {
    return false
  }
}

export const loadDraft = (draftId = 'create') => {
  try {
    const raw = localStorage.getItem(`${PREFIX}${draftId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const deleteDraft = (draftId = 'create') => {
  try {
    const key = `${PREFIX}${draftId}`
    localStorage.removeItem(key)
    localStorage.removeItem(`${key}${TS_SUFFIX}`)
    return true
  } catch {
    return false
  }
}

export const hasDraft = (draftId = 'create') => {
  try {
    return localStorage.getItem(`${PREFIX}${draftId}`) !== null
  } catch {
    return false
  }
}

export const getDraftTimestamp = (draftId = 'create') => {
  try {
    return localStorage.getItem(`${PREFIX}${draftId}${TS_SUFFIX}`)
  } catch {
    return null
  }
}

export const formatDraftTime = (timestamp) => {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleDateString()
}

export const getAllDraftIds = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX) && !k.endsWith(TS_SUFFIX))
      .map((k) => k.slice(PREFIX.length))
  } catch {
    return []
  }
}

export const getAllDrafts = () => {
  try {
    return getAllDraftIds()
      .map((id) => {
        const data = loadDraft(id)
        const timestamp = getDraftTimestamp(id) || data?.savedAt
        return {
          draftId: id,
          isCreate: id === 'create',
          name: data?.formData?.name?.trim() || 'Untitled Hardware Draft',
          type: data?.formData?.type || 'Pistol',
          caliber: data?.formData?.caliber || '9mm',
          price: data?.formData?.price ?? 0,
          image: data?.uploadedImageUrl || data?.imagePreview || '/guns/pistol.svg',
          timestamp,
          raw: data,
        }
      })
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  } catch {
    return []
  }
}

export const clearAllDrafts = () => {
  getAllDraftIds().forEach(deleteDraft)
}