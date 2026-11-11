import { useState, useEffect, useCallback } from 'react'
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

// Helper mengubah File menjadi Base64 Data URL yang permanen
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function CreateGunPage({ onBack, onSuccess }) {
  const [currentStep, setCurrentStep] = useState('upload')
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

  // State untuk menyimpan daftar gambar (berisi URL / Base64)
  const [galleryItems, setGalleryItems] = useState([])

  // Specifications & Steps
  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Striker-Fired' },
    { name: 'Capacity', quantity: '17 rounds' },
  ])
  const [steps, setSteps] = useState([
    'Verify firearm is completely unloaded and point in safe direction.',
    'Disassemble slide assembly from receiver frame for routine maintenance.',
  ])

  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showDraftModal, setShowDraftModal] = useState(() => hasDraft('create'))
  const [draftTimestamp, setDraftTimestamp] = useState(() => getDraftTimestamp('create'))

  const handleSaveDraft = useCallback(
    (notify = true) => {
      const urls = galleryItems.map((item) => item.url)
      const draftData = {
        formData,
        specs,
        steps,
        uploadedImageUrls: urls,
      }
      const saved = saveDraft(draftData, 'create')
      if (saved) {
        const ts = getDraftTimestamp('create')
        setDraftTimestamp(ts)
        if (notify) {
          setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
          setTimeout(() => setSuccessMsg(''), 3000)
        }
      }
    },
    [formData, specs, steps, galleryItems],
  )

  useEffect(() => {
    if (currentStep !== 'form') return
    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)
    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  const handleLoadDraft = () => {
    const draft = loadDraft('create')
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      const savedUrls = draft.uploadedImageUrls || draft.imagePreviews || []
      if (savedUrls.length > 0) {
        setGalleryItems(savedUrls.map((u) => ({ file: null, url: u })))
        setCurrentStep('form')
      }
      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // Pilih beberapa file sekaligus dan langsung baca sebagai Data URL
  const handleImagesChange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const newItems = []

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`File "${file.name}" melebihi batas 5MB.`)
        return
      }
      if (!allowed.includes(file.type)) {
        setError(`Format file "${file.name}" tidak didukung.`)
        return
      }
      const dataUrl = await fileToDataUrl(file)
      newItems.push({ file, url: dataUrl })
    }

    setGalleryItems((prev) => [...prev, ...newItems])
    setError('')
    e.target.value = ''
  }

  const handleAddPreset = (presetUrl) => {
    setGalleryItems((prev) => [...prev, { file: null, url: presetUrl }])
    setError('')
  }

  const handleRemoveImage = (index) => {
    setGalleryItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUploadAllImages = async () => {
    if (galleryItems.length === 0) {
      setError('Silakan pilih minimal 1 gambar produk terlebih dahulu.')
      return
    }

    try {
      setUploading(true)
      setError('')

      const processed = await Promise.all(
        galleryItems.map(async (item) => {
          if (!item.file) return item
          try {
            const res = await uploadService.uploadImage(item.file)
            if (res.success && res.data?.url) {
              return { file: null, url: res.data.url }
            }
          } catch {
            // Gunakan base64 dataUrl jika gagal unggah ke bucket
          }
          return { file: null, url: item.url }
        }),
      )

      setGalleryItems(processed)
      setCurrentStep('form')
    } catch (err) {
      setError(err.message || 'Gagal memproses gambar.')
    } finally {
      setUploading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
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
      setError('Please provide at least one maintenance / assembly step.')
      return
    }

    const allImages =
      galleryItems.length > 0
        ? galleryItems.map((item) => item.url)
        : ['/guns/pistol.svg']

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      caliber: formData.caliber,
      price: Number(formData.price) || 500,
      category: formData.category || 'makanan',
      description:
        formData.description.trim() ||
        `${formData.type} caliber ${formData.caliber}.`,
      image_url: allImages[0],
      images: allImages,
      prep_time: 15,
      cook_time: Number(formData.price) || 500,
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setCreating(true)
      const response = await gunService.createGun(payload)
      if (response.success || response.data) {
        deleteDraft('create')
        invalidateGunsCache()
        if (onSuccess) {
          onSuccess(response.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving product to server.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <div className="form-head-actions">
          {currentStep === 'form' && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => handleSaveDraft(true)}
              title="Save draft"
            >
              <Save size={14} /> Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Add a firearm or accessory to the catalog with support for multiple gallery images.
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

      <div className="form-steps-nav">
        <div
          className={`step-badge ${
            currentStep === 'upload' ? 'step-badge--active' : 'step-badge--done'
          }`}
        >
          1. Multi-Image Gallery ({galleryItems.length} selected)
        </div>
        <div className="step-badge-connector" />
        <div
          className={`step-badge ${
            currentStep === 'form' ? 'step-badge--active' : ''
          }`}
        >
          2. Specifications &amp; Details
        </div>
      </div>

      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">Weapon Imagery &amp; Angle Shots</h2>
          <p className="card-box-desc">
            Unggah lebih dari satu foto senjata (bisa pilih banyak file sekaligus atau klik berulang kali) maupun kombinasikan dengan preset di bawah.
          </p>

          <div className="upload-dropzone">
            <input
              id="gun-multi-image-input"
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImagesChange}
              className="hidden-file-input"
            />
            <label htmlFor="gun-multi-image-input" className="upload-label">
              <Upload size={36} className="upload-icon" />
              <span className="upload-main-text">
                Klik untuk menambahkan foto (Bisa pilih banyak gambar)
              </span>
              <span className="upload-sub-text">
                JPG, PNG, atau WebP (maks. 5MB per file)
              </span>
            </label>

            <div className="preset-selector">
              <span className="preset-title">Atau tambahkan preset vektor:</span>
              <div className="preset-pills">
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleAddPreset('/guns/pistol.svg')}
                >
                  + Pistol Vector
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleAddPreset('/guns/rifle.svg')}
                >
                  + Rifle Vector
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleAddPreset('/guns/shotgun.svg')}
                >
                  + Shotgun Vector
                </button>
              </div>
            </div>
          </div>

          {galleryItems.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div className="list-head" style={{ paddingTop: 0 }}>
                <h3 className="section-title">
                  Daftar Foto Terpilih ({galleryItems.length} Gambar)
                </h3>
                <span className="count">Gambar pertama menjadi sampul utama</span>
              </div>

              <div className="multi-image-grid">
                {galleryItems.map((item, idx) => (
                  <div key={idx} className="multi-image-card">
                    <img
                      src={item.url}
                      alt={`Preview ${idx + 1}`}
                      className="multi-image-thumb"
                    />
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

              <div className="preview-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleUploadAllImages}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader size={18} className="spin" /> Memproses Foto…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} /> Konfirmasi {galleryItems.length} Foto &amp; Lanjutkan
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="selected-thumb-bar" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '280px' }}>
                {galleryItems.map((item, i) => (
                  <img
                    key={i}
                    src={item.url}
                    alt={`Thumb ${i + 1}`}
                    className="thumb-small"
                    style={{ width: '44px', height: '44px', objectFit: 'contain' }}
                  />
                ))}
              </div>
              <div className="thumb-info">
                <span className="thumb-title">{galleryItems.length} Gambar Terpilih</span>
                <span className="thumb-sub">Siap disimpan ke katalog</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Tambah / Ubah Foto
            </button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Model Designation <span className="req">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g. Glock 19 Gen 5, Colt M4A1..."
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Platform / Category <span className="req">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleFormChange(e)
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                  }))
                }}
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
              <label htmlFor="caliber" className="form-label">
                Caliber / Chambering <span className="req">*</span>
              </label>
              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                placeholder="e.g. 9mm, 5.56mm, 12 Gauge"
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD) <span className="req">*</span>
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                placeholder="599"
                min="0"
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade / Build Quality <span className="req">*</span>
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Commercial / Standard</option>
                <option value="sedang">Mil-Spec / Service Issue</option>
                <option value="sulit">Match Grade / Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Armory Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Operational background, ergonomics, intended mission profile..."
              rows={3}
              className="form-textarea"
            />
          </div>

          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Specifications &amp; Components</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addSpec}
              >
                <Plus size={14} /> Add Spec
              </button>
            </div>
            <div className="multi-rows">
              {specs.map((spec, i) => (
                <div key={i} className="multi-row">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Barrel Length, Action)"
                    value={spec.name}
                    onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 16 inch, Striker-fired)"
                    value={spec.quantity}
                    onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeSpec(i)}
                    disabled={specs.length <= 1}
                    title="Remove item"
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
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addStep}
              >
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div className="multi-rows">
              {steps.map((st, i) => (
                <div key={i} className="step-row">
                  <span className="step-num">{i + 1}</span>
                  <input
                    type="text"
                    placeholder="e.g. Clear the chamber and lock slide back..."
                    value={st}
                    onChange={(e) => handleStepChange(i, e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                    title="Remove step"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="checkbox-row">
            <input
              id="is_featured"
              type="checkbox"
              name="is_featured"
              checked={formData.is_featured}
              onChange={handleFormChange}
              className="form-checkbox"
            />
            <label htmlFor="is_featured" className="checkbox-label">
              Feature in Armory Showcase (Highlight product on catalog)
            </label>
          </div>

          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--outline"
              onClick={onBack}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" /> Registering Hardware…
                </>
              ) : (
                'Commit to Armory'
              )}
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${
          draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'
        } was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}