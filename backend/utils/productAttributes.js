const PRODUCT_ATTRIBUTE_TYPES = new Set(['select', 'text', 'number']);
const PHYSICAL_WEIGHT_UNITS = new Set(['kg', 'g']);
const PHYSICAL_DIMENSION_UNITS = new Set(['cm']);

const toTrimmedString = (value) => String(value == null ? '' : value).trim();

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = toTrimmedString(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!['[', '{'].includes(trimmed.charAt(0))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeAttributeType = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  return PRODUCT_ATTRIBUTE_TYPES.has(normalized) ? normalized : 'select';
};

const normalizeOptionList = (value) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value.split(',')
    : [];
  const seen = new Set();
  const options = [];
  source.forEach((entry) => {
    const option = toTrimmedString(entry);
    if (!option) return;
    const key = option.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  });
  return options;
};

const normalizeAttributeDefaultValue = ({ type, value }) => {
  const raw = toTrimmedString(value);
  if (!raw) return '';
  if (type === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? String(parsed) : '';
  }
  return raw;
};

// Optional per-option unit prices for select attributes (e.g. size → price).
// Keys are stored lowercase and must match a declared option.
const normalizeOptionPrices = (input, options = []) => {
  const parsed = parseMaybeJson(input);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const allowed = new Set(options.map((option) => option.toLowerCase()));
  const normalized = {};
  Object.entries(parsed).forEach(([key, raw]) => {
    const optionKey = toTrimmedString(key).toLowerCase();
    const price = Number(raw);
    if (!allowed.has(optionKey) || !Number.isFinite(price) || price <= 0) return;
    normalized[optionKey] = Math.round(price * 100) / 100;
  });
  return Object.keys(normalized).length ? normalized : null;
};

// Optional per-option image link: lowercased option label → index into
// product.images (index-based because at creation time uploads have no URL yet).
const normalizeOptionImages = (input, options = []) => {
  const parsed = parseMaybeJson(input);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const allowed = new Set(options.map((option) => option.toLowerCase()));
  const normalized = {};
  Object.entries(parsed).forEach(([key, raw]) => {
    const optionKey = toTrimmedString(key).toLowerCase();
    const index = Number(raw);
    if (!allowed.has(optionKey) || !Number.isInteger(index) || index < 0 || index > 29) return;
    normalized[optionKey] = index;
  });
  return Object.keys(normalized).length ? normalized : null;
};

const normalizeOptionOutOfStock = (input, options = []) => {
  const parsed = parseMaybeJson(input);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const allowed = new Set(options.map((option) => option.toLowerCase()));
  const normalized = {};
  Object.entries(parsed).forEach(([key, raw]) => {
    const optionKey = toTrimmedString(key).toLowerCase();
    if (!allowed.has(optionKey) || !normalizeBoolean(raw, false)) return;
    normalized[optionKey] = true;
  });
  return Object.keys(normalized).length ? normalized : null;
};

export const normalizeProductAttributes = (input) => {
  const parsed = parseMaybeJson(input);
  const list = Array.isArray(parsed) ? parsed : [];
  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const type = normalizeAttributeType(entry.type);
      const name = toTrimmedString(entry.name || entry.label || entry.key || `Option ${index + 1}`);
      if (!name) return null;
      const options = type === 'select' ? normalizeOptionList(entry.options) : [];
      const optionPrices = type === 'select' ? normalizeOptionPrices(entry.optionPrices, options) : null;
      const optionImages = type === 'select' ? normalizeOptionImages(entry.optionImages, options) : null;
      const optionOutOfStock = type === 'select' ? normalizeOptionOutOfStock(entry.optionOutOfStock, options) : null;
      const defaultValue = normalizeAttributeDefaultValue({
        type,
        value: entry.defaultValue
      });
      return {
        key: toTrimmedString(entry.key) || name.toLowerCase().replace(/\s+/g, '_').slice(0, 60),
        name,
        type,
        options,
        required: normalizeBoolean(entry.required, false),
        defaultValue,
        ...(optionPrices ? { optionPrices } : {}),
        ...(optionImages ? { optionImages } : {}),
        ...(optionOutOfStock ? { optionOutOfStock } : {})
      };
    })
    .filter(Boolean);
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

const normalizeWeight = (value = {}) => {
  if (!value || typeof value !== 'object') return null;
  const rawValue = Number(value.value);
  const unit = toTrimmedString(value.unit).toLowerCase();
  if (!Number.isFinite(rawValue) || rawValue <= 0) return null;
  return {
    value: rawValue,
    unit: PHYSICAL_WEIGHT_UNITS.has(unit) ? unit : 'kg'
  };
};

const normalizeDimensions = (value = {}) => {
  if (!value || typeof value !== 'object') return null;
  const length = Number(value.length);
  const width = Number(value.width);
  const height = Number(value.height);
  const unit = toTrimmedString(value.unit).toLowerCase();
  if (![length, width, height].every((item) => Number.isFinite(item) && item > 0)) {
    return null;
  }
  return {
    length,
    width,
    height,
    unit: PHYSICAL_DIMENSION_UNITS.has(unit) ? unit : 'cm'
  };
};

export const normalizeProductPhysical = (input) => {
  const parsed = parseMaybeJson(input);
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const weight = normalizeWeight(source.weight);
  const dimensions = normalizeDimensions(source.dimensions);
  if (!weight && !dimensions) return {};
  return {
    ...(weight ? { weight } : {}),
    ...(dimensions ? { dimensions } : {})
  };
};

export const normalizeSelectedAttributes = (input) => {
  const parsed = parseMaybeJson(input);
  const list = Array.isArray(parsed) ? parsed : [];
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

// Resolve the image linked to the current selection (e.g. the red photo when
// "Rouge" is selected). Last matching attribute in order wins.
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
  for (const attribute of attributes) {
    if (attribute.type !== 'select' || !attribute.optionImages) continue;
    let value = selectedByName.get(attribute.name.toLowerCase()) || '';
    if (!value && attribute.defaultValue) value = attribute.defaultValue.toLowerCase();
    if (!value) continue;
    const candidate = attribute.optionImages[value];
    if (Number.isInteger(candidate) && candidate >= 0 && candidate < list.length) {
      imageIndex = candidate;
    }
  }
  return {
    applied: imageIndex >= 0,
    imageIndex,
    image: imageIndex >= 0 ? list[imageIndex] : null
  };
};

// Resolve the unit price for a given selection: a selected (or defaulted)
// option that defines a price replaces the base price. When several priced
// attributes are selected, the last one in attribute order wins.
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
  for (const attribute of attributes) {
    if (attribute.type !== 'select' || !attribute.optionPrices) continue;
    let value = selectedByName.get(attribute.name.toLowerCase()) || '';
    if (!value && attribute.defaultValue) value = attribute.defaultValue.toLowerCase();
    if (!value) continue;
    const optionPrice = attribute.optionPrices[value];
    if (Number.isFinite(optionPrice) && optionPrice > 0) {
      unitPrice = optionPrice;
      applied = true;
    }
  }
  return { unitPrice, applied };
};

export const buildSelectedAttributesSelectionKey = (selectedAttributes = []) =>
  normalizeSelectedAttributes(selectedAttributes)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
    .map((entry) => `${entry.name.toLowerCase()}:${entry.value.toLowerCase()}`)
    .join('|');

// Select attributes are always purchase choices. Requiring every declared
// group here prevents clients from bypassing color/size/etc. validation when
// legacy product data omitted the explicit `required` flag.
export const isProductAttributeSelectionRequired = (attribute = {}) =>
  Boolean(attribute.required) ||
  (attribute.type === 'select' && Array.isArray(attribute.options) && attribute.options.length > 0);

export const validateSelectedAttributesForProduct = ({
  productAttributes = [],
  selectedAttributes = []
}) => {
  const normalizedProductAttributes = normalizeProductAttributes(productAttributes);
  const normalizedSelectedAttributes = normalizeSelectedAttributes(selectedAttributes);
  const selectedByName = new Map(
    normalizedSelectedAttributes.map((entry) => [entry.name.toLowerCase(), entry.value])
  );
  const validatedSelectedAttributes = [];

  for (const attribute of normalizedProductAttributes) {
    const attributeKey = attribute.name.toLowerCase();
    let value = selectedByName.get(attributeKey) || '';
    if (!value && attribute.defaultValue) {
      value = attribute.defaultValue;
    }

    if (!value) {
      if (isProductAttributeSelectionRequired(attribute)) {
        return {
          valid: false,
          message: `L’option "${attribute.name}" est obligatoire.`,
          selectedAttributes: [],
          selectionKey: ''
        };
      }
      continue;
    }

    if (attribute.type === 'select') {
      const optionMatch = attribute.options.find(
        (option) => option.toLowerCase() === value.toLowerCase()
      );
      if (!optionMatch) {
        return {
          valid: false,
          message: `La valeur sélectionnée pour "${attribute.name}" est invalide.`,
          selectedAttributes: [],
          selectionKey: ''
        };
      }
      if (attribute.optionOutOfStock?.[optionMatch.toLowerCase()]) {
        return {
          valid: false,
          message: `L’option "${optionMatch}" pour "${attribute.name}" est en rupture de stock.`,
          selectedAttributes: [],
          selectionKey: ''
        };
      }
      validatedSelectedAttributes.push({ name: attribute.name, value: optionMatch });
      continue;
    }

    if (attribute.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return {
          valid: false,
          message: `La valeur de "${attribute.name}" doit être numérique.`,
          selectedAttributes: [],
          selectionKey: ''
        };
      }
      validatedSelectedAttributes.push({ name: attribute.name, value: String(parsed) });
      continue;
    }

    validatedSelectedAttributes.push({ name: attribute.name, value });
  }

  return {
    valid: true,
    message: '',
    selectedAttributes: validatedSelectedAttributes,
    selectionKey: buildSelectedAttributesSelectionKey(validatedSelectedAttributes)
  };
};
