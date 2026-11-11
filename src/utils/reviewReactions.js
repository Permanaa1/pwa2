// src/utils/reviewReactions.js
const REACTIONS_KEY = 'bore_barrel_review_reactions'

const getAllReactions = () => {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const saveAllReactions = (data) => {
  try {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(data))
  } catch {
    // Abaikan jika quota storage penuh
  }
}

/**
 * Mendapatkan status likes dan dislikes untuk satu review
 */
export const getReviewReactions = (reviewId, userId) => {
  const all = getAllReactions()
  const reviewData = all[reviewId] || { likes: [], dislikes: [] }
  const userReaction = reviewData.likes.includes(userId)
    ? 'like'
    : reviewData.dislikes.includes(userId)
    ? 'dislike'
    : null

  return {
    likesCount: reviewData.likes.length,
    dislikesCount: reviewData.dislikes.length,
    userReaction,
  }
}

/**
 * Toggle Like atau Dislike untuk sebuah review
 * @param {string|number} reviewId
 * @param {string} userId
 * @param {'like'|'dislike'} type
 */
export const toggleReviewReaction = (reviewId, userId, type) => {
  const all = getAllReactions()
  if (!all[reviewId]) {
    all[reviewId] = { likes: [], dislikes: [] }
  }

  const review = all[reviewId]
  const likeIndex = review.likes.indexOf(userId)
  const dislikeIndex = review.dislikes.indexOf(userId)

  if (type === 'like') {
    if (likeIndex > -1) {
      // Batal like jika diklik lagi
      review.likes.splice(likeIndex, 1)
    } else {
      // Tambah like & hapus dislike jika sebelumnya dislike
      review.likes.push(userId)
      if (dislikeIndex > -1) review.dislikes.splice(dislikeIndex, 1)
    }
  } else if (type === 'dislike') {
    if (dislikeIndex > -1) {
      // Batal dislike jika diklik lagi
      review.dislikes.splice(dislikeIndex, 1)
    } else {
      // Tambah dislike & hapus like jika sebelumnya like
      review.dislikes.push(userId)
      if (likeIndex > -1) review.likes.splice(likeIndex, 1)
    }
  }

  saveAllReactions(all)
  return getReviewReactions(reviewId, userId)
}