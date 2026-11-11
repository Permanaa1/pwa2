import { useState, useEffect, useCallback } from 'react'
import reviewService from '../services/reviewService'

// ---------------------------------------------------------------------------
// useReviews — fetch, update, and delete reviews for a specific product.
// ---------------------------------------------------------------------------
export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(async () => {
    if (!gunId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const response = await reviewService.getReviews(gunId)
      if (response.success) {
        setReviews(response.data || [])
      } else {
        setError(response.message || 'Failed to fetch reviews.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching reviews.')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [gunId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // Update ulasan
  const updateReview = async (reviewId, updatedData) => {
    try {
      const res = await reviewService.updateReview(reviewId, updatedData)
      if (res.success) {
        await fetchReviews()
        return true
      }
      return false
    } catch {
      // Fallback update state lokal jika server offline
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, rating: Number(updatedData.rating), comment: updatedData.comment }
            : r,
        ),
      )
      return true
    }
  }

  // Hapus ulasan
  const deleteReview = async (reviewId) => {
    try {
      const res = await reviewService.deleteReview(reviewId)
      if (res.success) {
        await fetchReviews()
        return true
      }
      return false
    } catch {
      // Fallback hapus dari state lokal jika server offline
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      return true
    }
  }

  return {
    reviews,
    loading,
    error,
    refetch: fetchReviews,
    updateReview,
    deleteReview,
  }
}

// ---------------------------------------------------------------------------
// useCreateReview — submit a new review for a product.
// ---------------------------------------------------------------------------
export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)
      const response = await reviewService.createReview(gunId, reviewData)
      if (response.success) {
        setSuccess(true)
        return response.data
      } else {
        setError(response.message || 'Failed to submit review.')
        return null
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createReview, loading, error, success }
}