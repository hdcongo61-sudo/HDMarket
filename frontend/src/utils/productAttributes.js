const toTrimmedString = (value) => String(value == null ? '' : value).trim();

// Optional per-option unit prices (e.g. size → price), keys lowercased.
const normalizeOptionPrices = (input, options = []) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const allowed = new Set(options.map((option) => option.toLowerCase()));
  const normalized = {};
  Object.entries(input).forEach(([key, raw]) => {
    const optionKey = toTrimmedString(key).toLowerCase();
    const price = Number(raw);
    if (!allowed.has(optionKey) || !Number.isFinite(price) || price <= 0) return;
    normalized[optionKey] = Math.round(price * 100) / 100;
  });
  return Object.keys(normalized).length ? normalized : null;
};

// Optional per-option image link (lowercased option label → product image index).
const normalizeOptionImages = (input, options = []) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const allowed = new Set(options.map((option) => option.toLowerCase()));
  const normalized = {};
  Object.entries(input).forEach(([key, raw]) => {
    const optionKey = toTrimmedString(key).toLowerCase();
    const index = Number(raw);
    if (!allowed.has(optionKey) || !Number.isInteger(index) || index < 0 || index > 29) return;
    normalized[optionKey] = index;
  });
  return Object.keys(normalized).length ? normalized : null;
};

export const normalizeProductAttributes = (input) => {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const type = ['select', 'text', 'number'].includes(String(entry.type || '').toLowerCase())
        ? String(entry.type).toLowerCase()
        : 'select';
      const name = toTrimmedString(entry.name || entry.label || `Option ${index + 1}`);
      if (!name) return null;
      const options = Array.isArray(entry.options)
        ? entry.options.map((option) => toTrimmedString(option)).filter(Boolean)
        : [];
      const optionPrices = type === 'select' ? normalizeOptionPrices(entry.optionPrices, options) : null;
      const optionImages = type === 'select' ? normalizeOptionImages(entry.optionImages, options) : null;
      return {
        key: toTrimmedString(entry.key) || name.toLowerCase().replace(/\s+/g, '_'),
        name,
        type,
        options,
        required: Boolean(entry.required),
        defaultValue: toTrimmedString(entry.defaultValue),
        ...(optionPrices ? { optionPrices } : {}),
        ...(optionImages ? { optionImages } : {})
      };
    })
    .filter(Boolean);
};

// Mirror of the backend rule: the image linked to the current selection.
export const resolveSelectedAttributesImage = ({
  productAttributes = [],
  selectedAttributes = [],
  images = []
}) => {
  const attributes = normalizeProductAttributes(productAttributes);
  const selected = normalizeSelectedAttributes(selectedAttributes);
  const list = Array.isArray(images) ? images : [];
  const selectedByName = new Map(
    selected.map((entry) => [entry.name.toLowerCase(), entry.value.toLowerCase()])
  );
  let imageIndex = -1;
  attributes.forEach((attribute) => {
    if (attribute.type !== 'select' || !attribute.optionImages) return;
    let value = selectedByName.get(attribute.name.toLowerCase()) || '';
    if (!value && attribute.defaultValue) value = attribute.defaultValue.toLowerCase();
    if (!value) return;
    const candidate = attribute.optionImages[value];
    if (Number.isInteger(candidate) && candidate >= 0 && candidate < list.length) {
      imageIndex = candidate;
    }
  });
  return {
    applied: imageIndex >= 0,
    imageIndex,
    image: imageIndex >= 0 ? list[imageIndex] : null
  };
};

// Mirror of the backend rule: a selected (or defaulted) option with a defined
// price replaces the base price; last priced attribute in order wins.
export const resolveSelectedAttributesPrice = ({
  productAttributes = [],
  selectedAttributes = [],
  basePrice = 0
}) => {
  const attributes = normalizeProductAttributes(productAttributes);
  const selected = normalizeSelectedAttributes(selectedAttributes);
  const selectedByName = new Map(
    selected.map((entry) => [entry.name.toLowerCase(), entry.value.toLowerCase()])
  );
  let unitPrice = Number(basePrice) || 0;
  let applied = false;
  attributes.forEach((attribute) => {
    if (attribute.type !== 'select' || !attribute.optionPrices) return;
    let value = selectedByName.get(attribute.name.toLowerCase()) || '';
    if (!value && attribute.defaultValue) value = attribute.defaultValue.toLowerCase();
    if (!value) return;
    const optionPrice = attribute.optionPrices[value];
    if (Number.isFinite(optionPrice) && optionPrice > 0) {
      unitPrice = optionPrice;
      applied = true;
    }
  });
  return { unitPrice, applied };
};

// Resolve the price attached to a gallery image. Photo-linked variants store
// their image indexes in optionImages and their prices in optionPrices.
export const resolveProductImagePrice = ({ productAttributes = [], imageIndex = -1 }) => {
  if (!Number.isInteger(imageIndex) || imageIndex < 0) return { unitPrice: 0, applied: false };
  const attributes = normalizeProductAttributes(productAttributes);
  let unitPrice = 0;
  let applied = false;
  attributes.forEach((attribute) => {
    if (attribute.type !== 'select' || !attribute.optionImages || !attribute.optionPrices) return;
    Object.entries(attribute.optionImages).forEach(([optionKey, linkedIndex]) => {
      const price = Number(attribute.optionPrices?.[optionKey]);
      if (linkedIndex === imageIndex && Number.isFinite(price) && price > 0) {
        unitPrice = price;
        applied = true;
      }
    });
  });
  return { unitPrice, applied };
};

export const getHighestProductPrice = ({ productAttributes = [], basePrice = 0 }) => {
  let highest = Number(basePrice) || 0;
  normalizeProductAttributes(productAttributes).forEach((attribute) => {
    Object.values(attribute.optionPrices || {}).forEach((rawPrice) => {
      const price = Number(rawPrice);
      if (Number.isFinite(price) && price > highest) highest = price;
    });
  });
  return highest;
};

// Product cards advertise the lowest available photo/variant price. The base
// price is used only when no photo-linked option has its own valid price.
export const getLowestProductPrice = ({ productAttributes = [], basePrice = 0 }) => {
  const optionPrices = [];
  normalizeProductAttributes(productAttributes).forEach((attribute) => {
    if (!attribute.optionImages) return;
    Object.keys(attribute.optionImages).forEach((optionKey) => {
      const price = Number(attribute.optionPrices?.[optionKey]);
      if (Number.isFinite(price) && price > 0) optionPrices.push(price);
    });
  });
  return optionPrices.length ? Math.min(...optionPrices) : Number(basePrice) || 0;
};

export const normalizeSelectedAttributes = (input) => {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  return list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = toTrimmedString(entry.name || entry.label || entry.key);
      const value = toTrimmedString(entry.value);
      if (!name || !value) return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return { name, value };
    })
    .filter(Boolean);
};

export const buildSelectedAttributesSelectionKey = (selectedAttributes = []) =>
  normalizeSelectedAttributes(selectedAttributes)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
    .map((entry) => `${entry.name.toLowerCase()}:${entry.value.toLowerCase()}`)
    .join('|');

export const getDefaultSelectedAttributes = (productAttributes = []) =>
  normalizeProductAttributes(productAttributes)
    .filter((attribute) => attribute.defaultValue)
    .map((attribute) => ({ name: attribute.name, value: attribute.defaultValue }));

export const validateSelectedAttributes = ({
  productAttributes = [],
  selectedAttributes = []
}) => {
  const attributes = normalizeProductAttributes(productAttributes);
  const normalizedSelected = normalizeSelectedAttributes(selectedAttributes);
  const selectedMap = new Map(
    normalizedSelected.map((entry) => [entry.name.toLowerCase(), entry.value])
  );
  const normalized = [];
  const missing = [];

  attributes.forEach((attribute) => {
    let value = selectedMap.get(attribute.name.toLowerCase()) || '';
    if (!value && attribute.defaultValue) value = attribute.defaultValue;

    if (!value) {
      if (attribute.required) missing.push(attribute.name);
      return;
    }

    if (attribute.type === 'select') {
      const matchedOption = attribute.options.find(
        (option) => option.toLowerCase() === value.toLowerCase()
      );
      if (!matchedOption) {
        missing.push(attribute.name);
        return;
      }
      normalized.push({ name: attribute.name, value: matchedOption });
      return;
    }

    if (attribute.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        missing.push(attribute.name);
        return;
      }
      normalized.push({ name: attribute.name, value: String(parsed) });
      return;
    }

    normalized.push({ name: attribute.name, value });
  });

  return {
    valid: missing.length === 0,
    missing,
    selectedAttributes: normalized,
    selectionKey: buildSelectedAttributesSelectionKey(normalized)
  };
};

export const formatPhysicalSpecs = (physical = {}) => {
  const rows = [];
  const weightValue = Number(physical?.weight?.value);
  if (Number.isFinite(weightValue) && weightValue > 0) {
    rows.push({
      label: 'Poids',
      value: `${weightValue} ${toTrimmedString(physical?.weight?.unit) || 'kg'}`
    });
  }

  const length = Number(physical?.dimensions?.length);
  const width = Number(physical?.dimensions?.width);
  const height = Number(physical?.dimensions?.height);
  if ([length, width, height].every((item) => Number.isFinite(item) && item > 0)) {
    rows.push({
      label: 'Dimensions',
      value: `${length} × ${width} × ${height} ${toTrimmedString(physical?.dimensions?.unit) || 'cm'}`
    });
  }

  return rows;
};
