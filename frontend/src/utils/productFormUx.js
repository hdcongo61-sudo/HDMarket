export const getMissingProductFormFields = (form = {}) => [
  { name: 'title', label: "Titre de l'annonce", missing: !String(form.title || '').trim() },
  { name: 'description', label: 'Description détaillée', missing: !String(form.description || '').trim() },
  { name: 'category', label: 'Catégorie', missing: !String(form.category || '').trim() },
  { name: 'price', label: 'Prix', missing: !(Number(form.price || 0) > 0) }
].filter((field) => field.missing);

export const getListingFeeChangePreview = ({
  isEditing = false,
  approvedPrice = 0,
  currentReferencePrice = 0,
  currentRequiredFee = 0,
  previouslyPaidFee = 0,
  ratePercent = 0
} = {}) => {
  const normalizedApprovedPrice = Math.max(0, Number(approvedPrice || 0));
  const normalizedReferencePrice = Math.max(0, Number(currentReferencePrice || 0));
  const normalizedRequiredFee = Math.max(0, Number(currentRequiredFee || 0));
  const normalizedRate = Math.max(0, Number(ratePercent || 0));
  const estimatedPreviouslyPaidFee = Math.max(
    0,
    Number(previouslyPaidFee || 0) || Math.round((normalizedApprovedPrice * normalizedRate) / 100)
  );

  return {
    approvedReferencePrice: normalizedApprovedPrice,
    estimatedPreviouslyPaidFee,
    returnsToApprovedPrice: Boolean(
      isEditing && normalizedApprovedPrice > 0 && Math.abs(normalizedReferencePrice - normalizedApprovedPrice) < 1
    ),
    additionalFee: isEditing
      ? Math.max(0, normalizedRequiredFee - estimatedPreviouslyPaidFee)
      : normalizedRequiredFee
  };
};
