import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import { invalidateGunsCache } from '../hooks/useGuns'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function EditGunPage({ gun, gunId, onBack, onSuccess }) {
  const targetId = gunId || gun?.id
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan',
    difficulty: 'mudah',
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)

  const [specs, setSpecs] = useState([{ name: '', quantity: '' }])
  const [steps, setSteps] = useState([''])

  const [showDraftModal, setShowDraftModal] = useState(() =>
    targetId ? hasDraft(targetId) : false,
  )
  const [draftTimestamp, setDraftTimestamp] = useState(() =>
    targetId ? getDraftTimestamp(targetId) : null,
  )

  useEffect(() => {
    const fetchGun = async () => {
      try {
        setLoading(true)
        setError('')
        let data = gun
        if (!data || !data.ingredients || !data.steps) {
          if (targetId && !String(targetId).startsWith('local-')) {
            const res = await gunService.getGunById(targetId)
            if (res.success && res.data) {
              data = res.data
            }
          }
        }
        if (data) {
          setFormData({
            name: data.name || '',
            type: data.type || (data.category === 'makanan' ? 'Pistol' : 'Rifle'),
            caliber: data.caliber || '9mm',
            category: data.category || 'makanan',
            difficulty: data.difficulty || 'mudah',
            price: data.price ?? data.cook_time ?? 599,
            description: data.description || '',
            servings: data.servings || 1,
            is_featured: Boolean(data.is_featured),
          })

          const initialImages =
            Array.isArray(data.images) && data.images.length > 0
              ? data.images
              : [data.image_url || data.image || '/guns/pistol.svg']
          setImages(initialImages)

          const cleanIngs = Array.isArray(data.ingredients)
            ? data.ingredients.filter(
                (ing) =>
                  !String(ing.name || '').includes('IMAGES__') &&
                  !String(ing.name || '').includes('__IMG__') &&
                  !String(ing.quantity || '').startsWith('["data:image'),
              )
            : []

          if (cleanIngs.length > 0) {
            setSpecs(
              cleanIngs.map((ing) => ({
                name: ing.name || '',
                quantity: ing.quantity || '',
              })),
            )
          } else {
            setSpecs([
              { name: 'Platform', quantity: data.type || 'Pistol' },
              { name: 'Caliber', quantity: data.caliber || '9mm' },
            ])
          }

          if (data.steps && data.steps.length > 0) {
            setSteps(
              data.steps.map((st) =>
                typeof st === 'string' ? st : st.instruction || '',
              ),
            )
          } else {
            setSteps(['Standard manufacturer maintenance and cleaning protocol.'])
          }
        } else {
          setError('Hardware record could not be loaded.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load hardware record from server.')
      } finally {
        setLoading(false)
      }
    }
    if (targetId) {
      fetchGun()
    }
  }, [targetId, gun])

  const handleLoadDraft = () => {
    const draft = loadDraft(targetId)
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (draft.images) setImages(draft.images)
      setShowDraftModal(false)
      setSuccessMsg('Saved draft restored.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft(targetId)
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  const handleManualSaveDraft = () => {
    const draftData = {
      formData,
      specs,
      steps,
      images,
    }
    const saved = saveDraft(draftData, targetId)
    if (saved) {
      const ts = getDraftTimestamp(targetId)
      setDraftTimestamp(ts)
      setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleAddNewImages = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    try {
      setUploading(true)
      const uploadPromises = files.map(async (file) => {
        const base64Fallback = await fileToDataUrl(file)
        try {
          const res = await uploadService.uploadImage(file)
          return res.success && res.data?.url ? res.data.url : base64Fallback
        } catch {
          return base64Fallback
        }
      })
      const newUrls = await Promise.all(uploadPromises)
      setImages((prev) => [...prev, ...newUrls])
      setSuccessMsg(`${files.length} foto baru berhasil ditambahkan.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleAddPreset = (url) => {
    setImages((prev) => [...prev, url])
  }

  const handleRemoveImage = (index) => {
    if (images.length <= 1) {
      setError('Katalog harus memiliki minimal 1 gambar.')
      setTimeout(() => setError(''), 3000)
      return
    }
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }
  const addSpec = () => setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }
  const addStep = () => setSteps((prev) => [...prev, ''])
  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }
    const cleanSpecs = specs
      .filter((s) => s.name.trim() && !s.name.includes('IMAGES__'))
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))
    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }
    const cleanSteps = steps.filter((s) => s.trim()).map((s) => s.trim())
    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance step.')
      return
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type || (formData.category === 'minuman' ? 'Rifle' : 'Pistol'),
      caliber: formData.caliber || '9mm',
      price: Number(formData.price) || 500,
      category: formData.category || 'makanan',
      description:
        formData.description.trim() ||
        `${formData.type} caliber ${formData.caliber}.`,
      image_url: images[0] || '/guns/pistol.svg',
      images,
      prep_time: 15,
      cook_time: Number(formData.price) || 500,
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setUpdating(true)
      const res = await gunService.updateGun(targetId, payload)
      if (res.success || res.data) {
        deleteDraft(targetId)
        invalidateGunsCache()
        if (onSuccess) {
          onSuccess(res.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(res.message || 'Failed to update record on server.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while updating record.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="state-box">
        <Loader size={32} className="spin" />
        <p>Loading hardware details for editing…</p>
      </div>
    )
  }

  return (
    <div className="form-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={handleManualSaveDraft}
          title="Save draft"
        >
          <Save size={14} /> Save Draft
        </button>
      </div>

      <div className="form-title-group">
        <h1 className="display">Modify Hardware Record</h1>
        <p className="lede">
          Updating record ID: <code className="mono-badge">{targetId}</code>
        </p>
      </div>

      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="entry-form">
        <div className="card-box">
          <div className="list-head" style={{ paddingTop: 0, flexWrap: 'wrap', gap: '8px' }}>
            <h2 className="card-box-title">Visual Asset Gallery ({images.length} Foto)</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                id="edit-multi-gun-image"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleAddNewImages}
                className="hidden-file-input"
              />
              <label htmlFor="edit-multi-gun-image" className="btn btn--primary btn--sm">
                <Upload size={14} /> + Tambah Foto File
              </label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => handleAddPreset('/guns/pistol.svg')}
              >
                + Pistol SVG
              </button>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => handleAddPreset('/guns/rifle.svg')}
              >
                + Rifle SVG
              </button>
            </div>
          </div>

          {uploading && (
            <p style={{ fontSize: '0.85rem', color: 'var(--brass)' }}>
              <Loader size={14} className="spin" /> Memproses foto baru…
            </p>
          )}

          <div className="multi-image-grid" style={{ marginTop: '12px' }}>
            {images.map((src, idx) => (
              <div key={idx} className="multi-image-card">
                <img src={src} alt={`Asset ${idx + 1}`} className="multi-image-thumb" />
                {idx === 0 && <span className="primary-badge">Utama</span>}
                <button
                  type="button"
                  className="remove-img-btn"
                  onClick={() => handleRemoveImage(idx)}
                  title="Hapus foto ini"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">
              Model Designation <span className="req">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-type" className="form-label">
              Platform / Category <span className="req">*</span>
            </label>
            <select
              id="edit-type"
              name="type"
              value={formData.type}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  type: e.target.value,
                  category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                }))
              }
              className="form-select"
            >
              <option value="Pistol">Pistol (Sidearm)</option>
              <option value="Rifle">Rifle (Long Gun)</option>
              <option value="Shotgun">Shotgun (Smoothbore)</option>
              <option value="Submachine Gun">Submachine Gun</option>
            </select>
          </div>
        </div>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label htmlFor="edit-caliber" className="form-label">
              Caliber / Chambering <span className="req">*</span>
            </label>
            <input
              id="edit-caliber"
              type="text"
              name="caliber"
              value={formData.caliber}
              onChange={(e) => setFormData((p) => ({ ...p, caliber: e.target.value }))}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-price" className="form-label">
              Price (USD) <span className="req">*</span>
            </label>
            <input
              id="edit-price"
              type="number"
              name="price"
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
              className="form-input"
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-difficulty" className="form-label">
              Grade / Build Quality <span className="req">*</span>
            </label>
            <select
              id="edit-difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={(e) => setFormData((p) => ({ ...p, difficulty: e.target.value }))}
              className="form-select"
            >
              <option value="mudah">Commercial / Standard</option>
              <option value="sedang">Mil-Spec / Service Issue</option>
              <option value="sulit">Match Grade / Custom</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-desc" className="form-label">
            Armory Description
          </label>
          <textarea
            id="edit-desc"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="form-textarea"
          />
        </div>

        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Specifications &amp; Components</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addSpec}>
              <Plus size={14} /> Add Spec
            </button>
          </div>
          <div className="multi-rows">
            {specs.map((spec, i) => (
              <div key={i} className="multi-row">
                <input
                  type="text"
                  placeholder="Attribute"
                  value={spec.name}
                  onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={spec.quantity}
                  onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeSpec(i)}
                  disabled={specs.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Assembly &amp; Maintenance Protocol</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addStep}>
              <Plus size={14} /> Add Step
            </button>
          </div>
          <div className="multi-rows">
            {steps.map((st, i) => (
              <div key={i} className="step-row">
                <span className="step-num">{i + 1}</span>
                <input
                  type="text"
                  value={st}
                  onChange={(e) => handleStepChange(i, e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="checkbox-row">
          <input
            id="edit-is-featured"
            type="checkbox"
            name="is_featured"
            checked={formData.is_featured}
            onChange={(e) => setFormData((p) => ({ ...p, is_featured: e.target.checked }))}
            className="form-checkbox"
          />
          <label htmlFor="edit-is-featured" className="checkbox-label">
            Feature in Armory Showcase
          </label>
        </div>

        <div className="form-actions-bar">
          <button type="button" className="btn btn--outline" onClick={onBack} disabled={updating}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={updating}>
            {updating ? (
              <>
                <Loader size={18} className="spin" /> Updating Record…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={showDraftModal}
        title="Resume Unsaved Changes?"
        message={`An unsaved draft for this product was saved on ${
          draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'
        }. Would you like to restore it?`}
        confirmLabel="Restore Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}