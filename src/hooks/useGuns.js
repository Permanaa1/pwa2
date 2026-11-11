import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'

// Penyimpanan cache di memori dan sessionStorage
const queryCache = new Map()
const CACHE_PREFIX = 'bore_barrel_query_cache_'
const CACHE_TTL = 5 * 60 * 1000 // 5 menit

const getCachedData = (key) => {
  if (queryCache.has(key)) {
    const entry = queryCache.get(key)
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.payload
    }
    queryCache.delete(key)
  }
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        queryCache.set(key, parsed)
        return parsed.payload
      }
      sessionStorage.removeItem(CACHE_PREFIX + key)
    }
  } catch {
    // Abaikan jika sessionStorage penuh
  }
  return null
}

const setCachedData = (key, payload) => {
  const entry = { payload, timestamp: Date.now() }
  queryCache.set(key, entry)
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Abaikan jika gagal menyimpan ke sessionStorage
  }
}

export const invalidateGunsCache = () => {
  queryCache.clear()
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k)
    })
  } catch {
    // Abaikan error
  }
}

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(async (forceRefresh = false) => {
    const cacheKey = `guns_${paramKey}`

    // Gunakan data dari cache jika tersedia dan bukan force refresh
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey)
      if (cached) {
        setGuns(cached.data || [])
        setPagination(cached.pagination || null)
        setLoading(false)
        setError(null)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      const response = await gunService.getGuns(params)
      if (response.success) {
        const resultData = response.data || []
        const resultPagination = response.pagination || null
        setGuns(resultData)
        setPagination(resultPagination)
        setCachedData(cacheKey, { data: resultData, pagination: resultPagination })
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns(false)
  }, [fetchGuns])

  const refetch = useCallback(() => {
    invalidateGunsCache()
    return fetchGuns(true)
  }, [fetchGuns])

  return { guns, loading, error, pagination, refetch }
}

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async (forceRefresh = false) => {
    if (!id) {
      setLoading(false)
      return
    }

    const cacheKey = `gun_detail_${id}`
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey)
      if (cached) {
        setGun(cached)
        setLoading(false)
        setError(null)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      const response = await gunService.getGunById(id)
      if (response.success) {
        setGun(response.data)
        setCachedData(cacheKey, response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun(false)
  }, [fetchGun])

  const refetch = useCallback(() => {
    invalidateGunsCache()
    return fetchGun(true)
  }, [fetchGun])

  return { gun, loading, error, refetch }
}