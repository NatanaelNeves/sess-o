export function getReviewOwnerName(couple, authUserId) {
  if (!couple || !authUserId) return null;
  if (couple.uid1 === authUserId) return couple.name1 || null;
  if (couple.uid2 === authUserId) return couple.name2 || null;
  // quem não é do casal não tem review próprio — espelha reviewOwnerName() das
  // regras do Firestore, que retorna null e faz a escrita ser recusada.
  return null;
}

export function canWriteReview({ couple, authUserId, currentUserName, reviewData, previousReviews = {} }) {
  const ownerName = currentUserName || getReviewOwnerName(couple, authUserId);
  if (!ownerName) return false;

  const keys = Object.keys(reviewData || {});
  if (keys.length === 0) return false;

  const existingKeys = new Set(Object.keys(previousReviews || {}));
  return keys.every(key => key === ownerName || existingKeys.has(key));
}

export function buildReviewPayload({ currentUserName, previousReviews = {}, nextReview }) {
  if (!currentUserName) return previousReviews;
  return {
    ...previousReviews,
    [currentUserName]: nextReview,
  };
}
