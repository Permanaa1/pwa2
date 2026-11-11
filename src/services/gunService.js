import { apiClient, IS_SUPABASE } from '../config/api'

const MULTI_IMG_STORAGE_KEY = 'bore_barrel_multi_images'
const IMG_SPEC_PREFIX = '__IMAGES__:'

const getMultiImageMap = () => {
  try {
    const raw = localStorage.getItem(MULTI_IMG_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const saveMultiImagesLocal = (id, name, images) => {
  if (!Array.isArray(images) || images.length === 0) return
  try {
    const map = getMultiImageMap()
    if (id !== undefined && id !== null) map[String(id)] = images
    if (name) map[String(name).toLowerCase()] = images
    localStorage.setItem(MULTI_IMG_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Abaikan jika storage penuh
  }
}

const loadMultiImagesLocal = (id, name) => {
  const map = getMultiImageMap()
  if (id !== undefined && id !== null && Array.isArray(map[String(id)])) {
    return map[String(id)]
  }
  if (name && Array.isArray(map[String(name).toLowerCase()])) {
    return map[String(name).toLowerCase()]
  }
  return null
}

// Helper untuk mengecek apakah suatu string/spec adalah data gambar tersembunyi
const isEncodedImageSpec = (strOrObj) => {
  if (!strOrObj) return false
  if (typeof strOrObj === 'string') {
    const s = strOrObj.trim()
    return (
      s.startsWith('__IMAGES__') ||
      s.startsWith('_IMAGES__') ||
      s.startsWith('__IMG__') ||
      s.startsWith('["data:image') ||
      s.startsWith('["http') ||
      s.startsWith('["/guns/')
    )
  }
  if (typeof strOrObj === 'object') {
    const name = String(strOrObj.name || '').trim()
    const qty = String(strOrObj.quantity || '').trim()
    return (
      name.includes('IMAGES__') ||
      name.includes('__IMG__') ||
      qty.startsWith('["data:image') ||
      qty.startsWith('data:image/')
    )
  }
  return false
}

// Helper untuk mengekstrak array URL dari spec yang menyembunyikan gambar
const extractImagesFromSpecItem = (strOrObj) => {
  try {
    let rawVal = ''
    if (typeof strOrObj === 'string') {
      const colonIdx = strOrObj.indexOf(':')
      rawVal = colonIdx > -1 ? strOrObj.slice(colonIdx + 1).trim() : strOrObj.trim()
    } else if (typeof strOrObj === 'object' && strOrObj !== null) {
      rawVal = String(strOrObj.quantity || '').trim()
    }

    if (rawVal.startsWith('[')) {
      const parsed = JSON.parse(rawVal)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } else if (
      rawVal.startsWith('data:image') ||
      rawVal.startsWith('http') ||
      rawVal.startsWith('/')
    ) {
      return [rawVal]
    }
  } catch {
    // Abaikan jika JSON parse gagal
  }
  return []
}

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  const specsList = []
  let extractedSpecImages = []

  // 1. Proses `item.specs` dan pisahkan data gambar dari spesifikasi asli
  if (Array.isArray(item.specs)) {
    item.specs.forEach((s, idx) => {
      if (isEncodedImageSpec(s)) {
        const found = extractImagesFromSpecItem(s)
        extractedSpecImages.push(...found)
        return
      }

      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          const specName = s.substring(0, colonIndex).trim()
          const specVal = s.substring(colonIndex + 1).trim()
          if (isEncodedImageSpec({ name: specName, quantity: specVal })) {
            extractedSpecImages.push(
              ...extractImagesFromSpecItem({ name: specName, quantity: specVal }),
            )
            return
          }
          specsList.push({
            id: `spec-${idx}`,
            name: specName,
            quantity: specVal,
          })
        } else {
          specsList.push({
            id: `spec-${idx}`,
            name: 'Specification',
            quantity: s.trim(),
          })
        }
      } else if (s && typeof s === 'object') {
        specsList.push(s)
      }
    })
  } else if (Array.isArray(item.ingredients)) {
    item.ingredients.forEach((ing) => {
      if (isEncodedImageSpec(ing)) {
        extractedSpecImages.push(...extractImagesFromSpecItem(ing))
      } else {
        specsList.push(ing)
      }
    })
  }

  // 2. Kumpulkan semua gambar (Multiple Images)
  let imagesList = []

  if (Array.isArray(item.images) && item.images.length > 0) {
    imagesList = item.images.filter(Boolean)
  } else if (typeof item.images === 'string' && item.images.trim()) {
    try {
      const parsed = JSON.parse(item.images)
      if (Array.isArray(parsed)) imagesList = parsed.filter(Boolean)
    } catch {
      imagesList = item.images.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }

  // Jika `image_url` berupa JSON string array (misal `["url1","url2"]`)
  let primaryUrlFromField = item.image_url || item.image || ''
  if (
    typeof primaryUrlFromField === 'string' &&
    primaryUrlFromField.trim().startsWith('[')
  ) {
    try {
      const parsed = JSON.parse(primaryUrlFromField)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (imagesList.length === 0) imagesList = parsed.filter(Boolean)
        primaryUrlFromField = parsed[0] || '/guns/pistol.svg'
      }
    } catch {
      // Abaikan
    }
  }

  // Gunakan gambar hasil ekstraksi dari specs jika imagesList masih kosong
  if (imagesList.length === 0 && extractedSpecImages.length > 0) {
    imagesList = extractedSpecImages
  }

  // Cek juga di localStorage
  const localSaved = loadMultiImagesLocal(item.id, item.name)
  if (Array.isArray(localSaved) && localSaved.length > imagesList.length) {
    imagesList = localSaved
  }

  // Fallback jika tetap kosong
  if (imagesList.length === 0) {
    imagesList = [primaryUrlFromField || '/guns/pistol.svg']
  } else if (
    primaryUrlFromField &&
    !primaryUrlFromField.startsWith('[') &&
    !imagesList.includes(primaryUrlFromField)
  ) {
    imagesList = [primaryUrlFromField, ...imagesList]
  }

  // Hilangkan duplikat
  imagesList = Array.from(new Set(imagesList.filter(Boolean)))

  saveMultiImagesLocal(item.id, item.name, imagesList)

  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : [
          'Verify firearm is completely unloaded and point in safe direction.',
          'Inspect receiver and mechanism for maintenance.',
        ]

  const mainImage = imagesList[0] || '/guns/pistol.svg'

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: mainImage,
    image: mainImage,
    images: imagesList,
    ingredients: specsList,
    steps: stepsList,
  }
}

class GunService {
  async getGuns(params = {}) {
    if (IS_SUPABASE) {
      const queryParts = ['select=*']

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      if (params.limit) {
        queryParts.push(`limit=${params.limit}`)
      }

      const queryString = queryParts.join('&')
      const data = await apiClient.get(`/rest/v1/products?${queryString}`)
      const list = Array.isArray(data) ? data.map(normalizeProduct) : []

      return {
        success: true,
        data: list,
        pagination: {
          total: list.length,
          page: params.page || 1,
          limit: params.limit || 50,
        },
      }
    }

    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  async getGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  async createGun(data) {
    const imagesArray =
      Array.isArray(data.images) && data.images.length > 0
        ? data.images.filter(Boolean)
        : [data.image_url || data.image || '/guns/pistol.svg']

    if (IS_SUPABASE) {
      const cleanIngredients = Array.isArray(data.ingredients)
        ? data.ingredients.filter((i) => !isEncodedImageSpec(i))
        : []

      const baseSpecs = cleanIngredients.map((i) => `${i.name}: ${i.quantity}`)

      // Simpan array JSON gambar pada 1 entri khusus di specs agar tersimpan di Supabase
      const specsArray = [...baseSpecs, `${IMG_SPEC_PREFIX}${JSON.stringify(imagesArray)}`]

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: imagesArray[0] || '/guns/pistol.svg',
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      saveMultiImagesLocal(created?.id, data.name, imagesArray)

      return {
        success: true,
        data: normalizeProduct({ ...created, images: imagesArray }),
      }
    }

    const res = await apiClient.post('/api/v1/recipes', {
      ...data,
      image_url: imagesArray[0],
      images: imagesArray,
    })
    saveMultiImagesLocal(res?.data?.id, data.name, imagesArray)
    return res
  }

  async updateGun(id, data) {
    const imagesArray =
      Array.isArray(data.images) && data.images.length > 0
        ? data.images.filter(Boolean)
        : data.image_url
        ? [data.image_url]
        : undefined

    if (IS_SUPABASE) {
      const cleanIngredients = Array.isArray(data.ingredients)
        ? data.ingredients.filter((i) => !isEncodedImageSpec(i))
        : []

      let specsArray = cleanIngredients.map((i) => `${i.name}: ${i.quantity}`)

      if (imagesArray && imagesArray.length > 0) {
        specsArray.push(`${IMG_SPEC_PREFIX}${JSON.stringify(imagesArray)}`)
      }

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray.length > 0) payload.specs = specsArray
      if (imagesArray && imagesArray.length > 0) {
        payload.image_url = imagesArray[0]
      } else if (data.image_url !== undefined) {
        payload.image_url = data.image_url
      }

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      if (imagesArray) {
        saveMultiImagesLocal(id, data.name || updated?.name, imagesArray)
      }

      return {
        success: true,
        data: normalizeProduct({
          ...updated,
          ...(imagesArray ? { images: imagesArray } : {}),
        }),
      }
    }

    return apiClient.put(`/api/v1/recipes/${id}`, data)
  }

  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, data)
  }

  async deleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      return { success: true }
    }
    return apiClient.delete(`/api/v1/recipes/${id}`)
  }
}

export default new GunService()