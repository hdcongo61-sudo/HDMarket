// Pure helpers for reordering product photos in the product form.
//
// The form keeps a `displayOrder` array — a permutation of combined image
// indices ([0..existingCount-1] = existing photos, [existingCount..] = new
// uploads). `null` means "natural order". These helpers keep that permutation
// coherent when photos are moved, added, or removed.

export const materializeOrder = (displayOrder, total) =>
  Array.isArray(displayOrder) && displayOrder.length === total
    ? [...displayOrder]
    : Array.from({ length: total }, (_, index) => index);

/** Swaps the item at combinedIndex with its left (-1) or right (+1) neighbour. */
export const moveInOrder = (displayOrder, total, combinedIndex, direction) => {
  if (total < 2) return null;
  const order = materializeOrder(displayOrder, total);
  const position = order.indexOf(combinedIndex);
  const target = position + direction;
  if (position < 0 || target < 0 || target >= total) return null;
  [order[position], order[target]] = [order[target], order[position]];
  return order;
};

/** Drops a removed combined index and shifts the higher ones down. */
export const reconcileOrderAfterRemove = (displayOrder, combinedIndex) => {
  if (!Array.isArray(displayOrder)) return null;
  return displayOrder
    .filter((index) => index !== combinedIndex)
    .map((index) => (index > combinedIndex ? index - 1 : index));
};

/** Appends the combined indices of newly added photos (they appear last). */
export const reconcileOrderAfterAdd = (displayOrder, addedCount, previousTotal) => {
  if (!Array.isArray(displayOrder)) return null;
  return [
    ...displayOrder,
    ...Array.from({ length: addedCount }, (_, index) => previousTotal + index)
  ];
};

export const applyOrder = (list, displayOrder) => {
  if (!Array.isArray(list)) return [];
  const order = Array.isArray(displayOrder) && displayOrder.length === list.length
    ? displayOrder
    : Array.from({ length: list.length }, (_, index) => index);
  return order.map((index) => list[index]).filter(Boolean);
};

export const isValidPermutation = (order, length) =>
  Array.isArray(order) &&
  order.length === length &&
  new Set(order).size === length &&
  order.every((value) => Number.isInteger(value) && value >= 0 && value < length);
