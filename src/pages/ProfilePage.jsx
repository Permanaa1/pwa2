import { useState } from 'react'
import {
  Shield,
  Copy,
  Check,
  Save,
  Heart,
  FileText,
  Camera,
  Play,
  Edit3,
  Trash2,
  ArrowRight,
  X,
  Info,
  Phone,
  Archive,
  RotateCcw,
} from 'lucide-react'
import userService from '../services/userService'
import gunService from '../services/gunService'
import { useFavorites } from '../hooks/useFavorites'
import { invalidateGunsCache } from '../hooks/useGuns'
import {
  getAllDrafts,
  deleteDraft,
  formatDraftTime,
} from '../utils/draftStorage'
import {
  getArchivedGuns,
  restoreGun,
  removeFromArchivePermanently,
} from '../utils/archiveStorage'
import ConfirmModal from '../components/modals/ConfirmModal'
import { formatPrice } from '../utils/helpers'

export default function ProfilePage({ onReplaySplash, onNavigate }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [username, setUsername] = useState(profile.username || 'Shooter')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatar, setAvatar] = useState(profile.avatar || null)

  // State untuk Pop-up Modal Edit Profile
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // State untuk Daftar Draft & Arsip
  const [drafts, setDrafts] = useState(() => getAllDrafts())
  const [archivedGuns, setArchivedGuns] = useState(() => getArchivedGuns())
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null)
  const [deletingPermanent, setDeletingPermanent] = useState(false)

  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')
  const { favorites } = useFavorites()

  const showToast = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar image must be under 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatar(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleOpenEditModal = () => {
    setUsername(profile.username || 'Shooter')
    setBio(profile.bio || '')
    setAvatar(profile.avatar || null)
    setIsEditModalOpen(true)
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    const updated = {
      ...profile,
      username: username.trim() || 'Shooter',
      bio: bio.trim(),
      avatar,
    }
    const result = userService.saveUserProfile(updated)
    if (result.success) {
      setProfile(result.data)
      setIsEditModalOpen(false)
      showToast('Profile successfully updated.')
    } else {
      showToast('Failed to save profile.')
    }
  }

  const handleResumeDraft = (draft) => {
    if (!onNavigate) return
    if (draft.isCreate) {
      onNavigate('Create')
    } else {
      onNavigate('Edit', { id: draft.draftId, name: draft.name })
    }
  }

  const handleDeleteDraft = (draftId) => {
    deleteDraft(draftId)
    setDrafts(getAllDrafts())
    showToast('Draft removed.')
  }

  // Handler Restore dari Arsip
  const handleRestoreArchived = (item) => {
    restoreGun(item.id || item.name)
    invalidateGunsCache()
    setArchivedGuns(getArchivedGuns())
    showToast(`"${item.name}" has been restored to the catalog.`)
  }

  // Handler Hapus Permanen dari Arsip & Server
  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget) return
    try {
      setDeletingPermanent(true)
      const targetId = permanentDeleteTarget.id || permanentDeleteTarget.name
      if (targetId && !String(targetId).startsWith('local-')) {
        try {
          await gunService.deleteGun(targetId)
        } catch {
          // Tetap hapus dari lokal jika item tidak ada di server
        }
      }
      removeFromArchivePermanently(targetId)
      invalidateGunsCache()
      setArchivedGuns(getArchivedGuns())
      showToast(`"${permanentDeleteTarget.name}" permanently deleted.`)
      setPermanentDeleteTarget(null)
    } finally {
      setDeletingPermanent(false)
    }
  }

  return (
    <div className="profile-page">
      <section
        className="masthead"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, procurement statistics, saved drafts, archives, and armory info.
          </p>
        </div>
        {onReplaySplash && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onReplaySplash}
            title="Replay introductory splash animation"
          >
            <Play size={14} /> Replay Intro
          </button>
        )}
      </section>

      {feedback && (
        <div className="toast toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}

      {/* Operator Card */}
      <div className="profile-card">
        <div
          className="profile-card-top"
          style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="avatar-wrap">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.username} className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  <Shield size={36} stroke="var(--brass)" />
                </div>
              )}
            </div>
            <div className="profile-identity">
              <h2 className="display">{profile.username || 'Shooter'}</h2>
              <div className="profile-id-row">
                <span className="mono-badge">{profile.userId}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleCopyId}
                  title="Copy User ID to clipboard"
                >
                  {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="lede" style={{ marginTop: '8px', fontSize: '0.92rem' }}>
                {profile.bio || 'No station bio set. Click Edit Profile to add operator notes.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleOpenEditModal}
          >
            <Edit3 size={15} /> Edit Profile
          </button>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Procurement Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{drafts.length}</div>
            <div className="stat-label">Saved Offline Drafts</div>
          </div>
          <div className="stat-item">
            <Archive size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{archivedGuns.length}</div>
            <div className="stat-label">Archived Hardware</div>
          </div>
        </div>
      </div>

      {/* SECTION DRAFT KATALOG */}
      <section className="card-box" style={{ marginBottom: 0 }}>
        <div className="list-head" style={{ paddingTop: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} stroke="var(--brass)" /> Saved Hardware Drafts
          </h3>
          <span className="count">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
        </div>

        {drafts.length === 0 ? (
          <p className="lede" style={{ fontSize: '0.92rem', padding: '12px 0' }}>
            Belum ada katalog yang disimpan sebagai draft. Saat Anda menekan tombol &quot;Save Draft&quot; di halaman tambah/edit produk, daftarnya akan muncul di sini.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {drafts.map((d) => (
              <li
                key={d.draftId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '12px 16px',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={d.image}
                    alt={d.name}
                    style={{
                      width: '48px',
                      height: '48px',
                      objectFit: 'contain',
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: '4px',
                      padding: '4px',
                    }}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>
                      {d.name}{' '}
                      <span className="mono-badge" style={{ fontSize: '0.72rem', marginLeft: '6px' }}>
                        {d.isCreate ? 'New Draft' : `Edit #${String(d.draftId).slice(0, 6)}`}
                      </span>
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--steel)' }}>
                      {d.type} · {d.caliber} · {formatPrice(d.price)}
                      {d.timestamp ? ` — Saved ${formatDraftTime(d.timestamp)}` : ''}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => handleResumeDraft(d)}
                  >
                    Resume <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger-ghost btn--sm"
                    onClick={() => handleDeleteDraft(d.draftId)}
                    title="Delete draft"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SECTION ARSIP / SOFT DELETE */}
      <section className="card-box" style={{ marginBottom: 0 }}>
        <div className="list-head" style={{ paddingTop: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Archive size={18} stroke="var(--brass)" /> Archived Hardware (Soft Deleted)
          </h3>
          <span className="count">{archivedGuns.length} archived</span>
        </div>

        {archivedGuns.length === 0 ? (
          <p className="lede" style={{ fontSize: '0.92rem', padding: '12px 0' }}>
            Arsip kosong. Katalog yang dihapus (soft delete) dari halaman utama akan tersimpan di sini sebelum dihapus permanen.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {archivedGuns.map((item) => {
              const imgSrc = item.image_url || item.image || '/guns/pistol.svg'
              const price = item.price ?? item.cook_time ?? 0
              return (
                <li
                  key={item.id || item.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    padding: '12px 16px',
                    background: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: '4px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={imgSrc}
                      alt={item.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        objectFit: 'contain',
                        background: '#fff',
                        border: '1px solid var(--line)',
                        borderRadius: '4px',
                        padding: '4px',
                      }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '1rem' }}>
                        {item.name}
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--steel)' }}>
                        {item.type || item.category || 'Hardware'} · {formatPrice(price)}
                        {item.archivedAt ? ` — Archived ${formatDraftTime(item.archivedAt)}` : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => handleRestoreArchived(item)}
                      title="Restore to Catalog"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setPermanentDeleteTarget(item)}
                      title="Delete Permanently"
                    >
                      <Trash2 size={14} /> Delete Permanently
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* SECTION ABOUT & CONTACT */}
      <div className="form-grid">
        <section className="card-box" style={{ marginBottom: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Info size={18} stroke="var(--brass)" /> About — A one-room armory.
          </h3>
          <p className="lede" style={{ fontSize: '0.95rem' }}>
            Bore &amp; Barrel sells a short, honest list of firearms. Each piece is priced
            from the bench — no markup theatre, no filler.
          </p>
        </section>

        <section className="card-box" style={{ marginBottom: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Phone size={18} stroke="var(--brass)" /> Contact — Come by the shop.
          </h3>
          <p className="lede" style={{ fontSize: '0.95rem' }}>
            123 Range Road. Open Tuesday to Saturday, 10 to 6. Call (555) 010-0100.
          </p>
        </section>
      </div>

      {/* POP-UP MODAL EDIT PROFILE */}
      {isEditModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title display">Edit Armorer Profile</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="avatar-wrap" style={{ width: '68px', height: '68px' }}>
                  {avatar ? (
                    <img src={avatar} alt={username} className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder">
                      <Shield size={30} stroke="var(--brass)" />
                    </div>
                  )}
                  <label htmlFor="modal-avatar-input" className="avatar-upload-btn" title="Upload avatar">
                    <Camera size={14} />
                    <input
                      id="modal-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden-file-input"
                    />
                  </label>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--steel)' }}>
                  Klik ikon kamera untuk mengganti foto profil (Maks. 2MB).
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="prof-name" className="form-label">
                  Callsign / Operator Alias
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Operator Delta, Master Gunsmith"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="prof-bio" className="form-label">
                  Armory Notes / Station Bio
                </label>
                <textarea
                  id="prof-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Qualifications, preferred calibers, unit assignment..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  <Save size={16} /> Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PERMANEN */}
      <ConfirmModal
        open={Boolean(permanentDeleteTarget)}
        title="Permanent Delete"
        message={`Are you sure you want to permanently delete "${permanentDeleteTarget?.name}" from the armory database? This action cannot be undone.`}
        confirmLabel="Delete Forever"
        danger
        loading={deletingPermanent}
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setPermanentDeleteTarget(null)}
      />
    </div>
  )
}