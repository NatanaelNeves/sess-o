export function getAccountDeletionRole(couple, userId) {
  if (!couple || !userId) return "account-only";
  if (couple.uid1 === userId) return "owner";
  if (couple.uid2 === userId) return "partner";
  return "account-only";
}

export function withoutUserReview(reviews = {}, userName) {
  const next = { ...reviews };
  if (userName) delete next[userName];
  return next;
}

export function chunkItems(items, size = 400) {
  if (!Number.isInteger(size) || size < 1) throw new Error("Chunk size must be a positive integer");
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
