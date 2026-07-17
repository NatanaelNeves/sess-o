import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPayload, canWriteReview, getReviewOwnerName } from './reviewPermissions.js';

test('identifies the review owner for the signed-in user', () => {
  const couple = { uid1: 'u1', uid2: 'u2', name1: 'Natanael', name2: 'Vitória' };
  assert.equal(getReviewOwnerName(couple, 'u1'), 'Natanael');
  assert.equal(getReviewOwnerName(couple, 'u2'), 'Vitória');
  assert.equal(getReviewOwnerName(couple, 'u3'), null);
});

test('allows only the current user to submit their own review', () => {
  const couple = { uid1: 'u1', uid2: 'u2', name1: 'Natanael', name2: 'Vitória' };
  const payload = { Natanael: { rating: 5, text: 'Perfeito' } };
  assert.equal(canWriteReview({ couple, authUserId: 'u1', reviewData: payload }), true);
  assert.equal(canWriteReview({ couple, authUserId: 'u1', reviewData: { Vitória: { rating: 5, text: 'Perfeito' } } }), false);
});

test('builds a payload that preserves the current user review only', () => {
  const previous = { Natanael: { rating: 4, text: 'Gostei' }, Vitória: { rating: 3, text: 'Boa' } };
  const payload = buildReviewPayload({ currentUserName: 'Natanael', previousReviews: previous, nextReview: { rating: 5, text: 'Adorei' } });
  assert.deepEqual(payload, {
    Natanael: { rating: 5, text: 'Adorei' },
    Vitória: { rating: 3, text: 'Boa' },
  });
});
