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
