import type { SwrBucket } from '../types';

/**
 * Look up the SWR rate for a given retirement age. Returns the matching bucket's
 * rate if any; otherwise returns the fallback (the global safeWithdrawalRate).
 *
 * Buckets are inclusive on both ends. Buckets are expected to be non-overlapping
 * (enforced at form validation); when overlap exists, the first matching bucket
 * wins.
 */
export function rateForAge(
  age: number,
  buckets: SwrBucket[],
  fallback: number,
): number {
  const match = buckets.find(b => age >= b.startAge && age <= b.endAge);
  return match ? match.rate : fallback;
}

export interface BucketValidationResult {
  errors: Record<number, string[]>; // bucket index → error messages
}

/**
 * Validate a list of SwrBuckets. Returns a map from bucket index to error
 * messages. Empty errors object means all buckets are valid.
 *
 * Rules:
 *   - endAge >= startAge per bucket.
 *   - rate > 0 per bucket.
 *   - No two buckets overlap. Buckets [a1,b1] and [a2,b2] overlap iff
 *     a1 <= b2 AND a2 <= b1.
 */
export function validateBuckets(buckets: SwrBucket[]): BucketValidationResult {
  const errors: Record<number, string[]> = {};
  const addError = (index: number, message: string) => {
    if (!errors[index]) errors[index] = [];
    errors[index].push(message);
  };

  // Per-bucket rules
  buckets.forEach((b, i) => {
    if (b.endAge < b.startAge) {
      addError(i, 'End age must be ≥ start age.');
    }
    if (b.rate <= 0) {
      addError(i, 'Rate must be greater than 0.');
    }
  });

  // Pairwise overlap check
  for (let i = 0; i < buckets.length; i++) {
    for (let j = i + 1; j < buckets.length; j++) {
      const a = buckets[i];
      const b = buckets[j];
      // Skip pairs that already have an inverted-range error to avoid noise
      if (a.endAge < a.startAge || b.endAge < b.startAge) continue;
      if (a.startAge <= b.endAge && b.startAge <= a.endAge) {
        addError(i, `Overlaps with bucket #${j + 1} (ages ${b.startAge}–${b.endAge}).`);
        addError(j, `Overlaps with bucket #${i + 1} (ages ${a.startAge}–${a.endAge}).`);
      }
    }
  }

  return { errors };
}
