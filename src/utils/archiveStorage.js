const ARCHIVE_KEY = 'bore_barrel_archived_guns'
const DELETED_LOCAL_KEY = 'bore_barrel_deleted_local_ids'

export const getArchivedGuns = () => {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const isGunArchived = (idOrName) => {
  if (!idOrName) return false
  const list = getArchivedGuns()
  return list.some(
    (item) =>
      String(item.id) === String(idOrName) ||
      String(item.name) === String(idOrName),
  )
}

export const archiveGun = (gun) => {
  try {
    const list = getArchivedGuns()
    const identifier = gun.id || gun.name
    const exists = list.some(
      (item) => String(item.id || item.name) === String(identifier),
    )
    if (!exists) {
      const archivedItem = {
        ...gun,
        id: gun.id || gun.name,
        archivedAt: new Date().toISOString(),
      }
      list.unshift(archivedItem)
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list))
    }
    return true
  } catch {
    return false
  }
}

export const restoreGun = (idOrName) => {
  try {
    const list = getArchivedGuns().filter(
      (item) =>
        String(item.id) !== String(idOrName) &&
        String(item.name) !== String(idOrName),
    )
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export const getDeletedLocalIds = () => {
  try {
    const raw = localStorage.getItem(DELETED_LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const isLocalDeleted = (idOrName) => {
  if (!idOrName) return false
  const list = getDeletedLocalIds()
  return list.includes(String(idOrName))
}

export const removeFromArchivePermanently = (idOrName) => {
  try {
    restoreGun(idOrName)
    const deletedIds = getDeletedLocalIds()
    if (!deletedIds.includes(String(idOrName))) {
      deletedIds.push(String(idOrName))
      localStorage.setItem(DELETED_LOCAL_KEY, JSON.stringify(deletedIds))
    }
    return true
  } catch {
    return false
  }
}