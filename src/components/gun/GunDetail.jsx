import { useState, useMemo } from 'react'
import {
  ArrowLeft,
  Star,
  Send,
  Loader,
  Share2,
  Edit2,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import { useReviews, useCreateReview } from '../../hooks/useReviews'
import { useGunById } from '../../hooks/useGuns'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'
import {
  getReviewReactions,
  toggleReviewReaction,
} from '../../utils/reviewReactions'

export default function GunDetail({ gun, onBack, onEdit, onDelete }) {
  const isSharedLink = Object.keys(gun).length === 1 && gun.id
  const { gun: fetchedGun, loading: fetchingGun } = useGunById(
    isSharedLink ? gun.id : null,
  )

  const displayGun = fetchedGun || gun

  const category = displayGun.type || displayGun.category || '—'
  const caliber = displayGun.caliber || displayGun.difficulty || ''
  const price = displayGun.price ?? displayGun.cook_time ?? 0

  // Pisahkan spesifikasi murni dan ekstrak gambar jika ada tag _IMAGES__ yang tersisa di ingredients
  const { cleanIngredients, extraImagesFromSpecs } = useMemo(() => {
    const clean = []
    const extraImgs = []

    if (Array.isArray(displayGun.ingredients)) {
      displayGun.ingredients.forEach((ing) => {
        const nameStr = String(ing.name || '').trim()
        const qtyStr = String(ing.quantity || '').trim()

        if (
          nameStr.includes('IMAGES__') ||
          nameStr.includes('__IMG__') ||
          qtyStr.startsWith('["data:image') ||
          qtyStr.startsWith('data:image/')
        ) {
          try {
            if (qtyStr.startsWith('[')) {
              const parsed = JSON.parse(qtyStr)
              if (Array.isArray(parsed)) extraImgs.push(...parsed)
            } else if (qtyStr.startsWith('data:image') || qtyStr.startsWith('http') || qtyStr.startsWith('/')) {
              extraImgs.push(qtyStr)
            }
          } catch {
            // Abaikan error parse
          }
        } else {
          clean.push(ing)
        }
      })
    }
    return { cleanIngredients: clean, extraImagesFromSpecs: extraImgs }
  }, [displayGun.ingredients])

  // Gabungkan semua sumber gambar untuk Galeri Multi-Gambar
  const allImages = useMemo(() => {
    const base =
      Array.isArray(displayGun.images) && displayGun.images.length > 0
        ? displayGun.images
        : []
    const combined = [...base, ...extraImagesFromSpecs].filter(Boolean)
    if (combined.length === 0) {
      return [displayGun.image_url || displayGun.image || '/guns/pistol.svg']
    }
    return Array.from(new Set(combined))
  }, [displayGun.images, displayGun.image_url, displayGun.image, extraImagesFromSpecs])

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const currentMainImage = allImages[activeImageIndex] || allImages[0]

  // Hooks Review
  const {
    reviews,
    loading: reviewsLoading,
    refetch: refetchReviews,
    updateReview,
    deleteReview,
  } = useReviews(displayGun.id)

  const { createReview, loading: submitting } = useCreateReview()

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')
  const [updatingReview, setUpdatingReview] = useState(false)

  const [, setReactionVersion] = useState(0)

  const currentUserId = useMemo(() => getUserIdentifier(), [])

  const avgRating = displayGun.average_rating || averageRating(reviews)
  const reviewCount = displayGun.review_count ?? reviews.length

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${displayGun.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Link produk berhasil disalin!')
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')
    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }
    const result = await createReview(displayGun.id, {
      user_id: currentUserId,
      user_identifier: currentUserId,
      rating,
      comment: comment.trim(),
    })
    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      refetchReviews()
      setTimeout(() => setReviewSuccess(''), 3000)
    } else {
      setReviewError('Could not submit review. The server may be unavailable.')
    }
  }

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev.id)
    setEditRating(rev.rating || 5)
    setEditComment(rev.comment || '')
  }

  const handleSaveEdit = async (reviewId) => {
    setUpdatingReview(true)
    const success = await updateReview(reviewId, {
      rating: editRating,
      comment: editComment.trim(),
    })
    if (success) {
      setEditingReviewId(null)
    } else {
      alert('Failed to update review.')
    }
    setUpdatingReview(false)
  }

  const handleDeleteReview = async (reviewId) => {
    if (window.confirm('Are you sure you want to delete your review?')) {
      const success = await deleteReview(reviewId)
      if (!success) alert('Failed to delete review.')
    }
  }

  const handleReaction = (reviewId, type) => {
    toggleReviewReaction(reviewId, currentUserId, type)
    setReactionVersion((v) => v + 1)
  }

  if (isSharedLink && fetchingGun) {
    return (
      <div className="state-box" style={{ marginTop: '15vh' }}>
        <Loader className="spin" size={32} />
        <p>Memuat spesifikasi katalog...</p>
      </div>
    )
  }

  return (
    <div className="detail">
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero with Multi-Image Gallery */}
      <div className="detail-hero">
        <div className="detail-gallery-wrap">
          <img
            className="detail-img"
            src={currentMainImage}
            alt={displayGun.name}
            loading="lazy"
            style={{ objectFit: 'contain', padding: '12px' }}
          />
          {allImages.length > 1 && (
            <div className="detail-gallery-thumbs">
              {allImages.map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`gallery-thumb-btn ${
                    activeImageIndex === idx ? 'active' : ''
                  }`}
                  onClick={() => setActiveImageIndex(idx)}
                  title={`Lihat Gambar ${idx + 1}`}
                >
                  <img
                    src={src}
                    alt={`${displayGun.name} angle ${idx + 1}`}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1 className="display">{displayGun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>
          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}
          <div className="detail-actions">
            <button type="button" className="btn btn--outline" onClick={handleShare}>
              <Share2 size={16} /> Share Link
            </button>
            <FavoriteButton gunId={displayGun.id || displayGun.name} />
            {onEdit && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => onEdit(displayGun)}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => onDelete(displayGun)}
              >
                Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{displayGun.description || 'No description available.'}</p>
      </section>

      {/* Specifications (Sudah bersih dari teks _IMAGES__) */}
      {cleanIngredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {cleanIngredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Assembly / Maintenance Steps */}
      {displayGun.steps && displayGun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {displayGun.steps.map((step, i) => (
              <li key={step.id || i}>{step.instruction || step}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews &amp; Ratings</h2>

        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>
          <textarea
            className="review-input"
            rows="3"
            placeholder="Write an operational feedback review…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            required
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !displayGun.id}
          >
            {submitting ? (
              <>
                <Loader size={16} className="spin" /> Submitting…
              </>
            ) : (
              <>
                <Send size={16} /> Submit Review
              </>
            )}
          </button>
          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
        </form>

        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => {
              const isMyReview =
                rev.user_id === currentUserId ||
                rev.user_identifier === currentUserId ||
                rev.user_identifier ===
                  `Operator ${String(currentUserId).substring(0, 8)}`

              const isEditing = editingReviewId === rev.id
              const reactions = getReviewReactions(rev.id, currentUserId)

              return (
                <li key={rev.id} className="review-item">
                  <div className="review-head">
                    <div>
                      <span className="review-user">
                        {rev.user_identifier || 'Anonymous'}
                      </span>
                      {isMyReview && (
                        <span
                          className="mono-badge"
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.72rem',
                            color: 'var(--brass)',
                            borderColor: 'var(--brass)',
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>

                    {!isEditing && (
                      <span className="review-stars-display">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            size={14}
                            fill={i < rev.rating ? 'var(--brass)' : 'none'}
                            stroke={
                              i < rev.rating ? 'var(--brass)' : 'var(--line)'
                            }
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div
                      style={{
                        marginTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div className="review-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="star-btn"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={
                                n <= editRating
                                  ? 'var(--brass)'
                                  : 'var(--steel)'
                              }
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="review-input"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="Edit your review…"
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => handleSaveEdit(rev.id)}
                          disabled={updatingReview}
                        >
                          <Check size={14} /> Save Changes
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => setEditingReviewId(null)}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {rev.comment && (
                        <p className="review-comment">{rev.comment}</p>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '10px',
                        }}
                      >
                        {isMyReview ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              onClick={() => handleStartEdit(rev)}
                              title="Edit Review"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger-ghost btn--sm"
                              onClick={() => handleDeleteReview(rev.id)}
                              title="Delete Review"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <button
                              type="button"
                              className={`reaction-btn ${
                                reactions.userReaction === 'like' ? 'active' : ''
                              }`}
                              onClick={() => handleReaction(rev.id, 'like')}
                              title="Helpful Review"
                            >
                              <ThumbsUp size={14} />
                              <span>{reactions.likesCount}</span>
                            </button>

                            <button
                              type="button"
                              className={`reaction-btn ${
                                reactions.userReaction === 'dislike'
                                  ? 'active'
                                  : ''
                              }`}
                              onClick={() => handleReaction(rev.id, 'dislike')}
                              title="Not Helpful"
                            >
                              <ThumbsDown size={14} />
                              <span>{reactions.dislikesCount}</span>
                            </button>
                          </div>
                        )}
                        <span
                          style={{ fontSize: '0.75rem', color: 'var(--steel)' }}
                        >
                          {rev.created_at
                            ? new Date(rev.created_at).toLocaleDateString()
                            : ''}
                        </span>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>
    </div>
  )
}