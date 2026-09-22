import { normalizeProductAttributes } from './productAttributes.js';

const toPositivePrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

// The visible catalog price is the lowest price among photo-linked options,
// falling back to the persisted product price when no linked option is priced.
export const getLowestProductPrice = ({ productAttributes = [], basePrice = 0 } = {}) => {
  const optionPrices = [];
  normalizeProductAttributes(productAttributes).forEach((attribute) => {
    if (!attribute.optionImages) return;
    Object.keys(attribute.optionImages).forEach((optionKey) => {
      const price = toPositivePrice(attribute.optionPrices?.[optionKey]);
      if (price > 0) optionPrices.push(price);
    });
  });
  return optionPrices.length ? Math.min(...optionPrices) : toPositivePrice(basePrice);
};

// MongoDB expression equivalent of getLowestProductPrice. It is used before
// pagination so public price filters and sorting match the price rendered by
// ProductCard and ProductDetails, including older products without a cached
// derived price field.
export const buildPublicDisplayPriceExpression = () => ({
  $let: {
    vars: {
      linkedPrices: {
        $reduce: {
          input: { $ifNull: ['$attributes', []] },
          initialValue: [],
          in: {
            $concatArrays: [
              '$$value',
              {
                $map: {
                  input: {
                    $filter: {
                      input: {
                        $objectToArray: { $ifNull: ['$$this.optionPrices', {}] }
                      },
                      as: 'priceEntry',
                      cond: {
                        $in: [
                          '$$priceEntry.k',
                          {
                            $map: {
                              input: {
                                $objectToArray: { $ifNull: ['$$this.optionImages', {}] }
                              },
                              as: 'imageEntry',
                              in: '$$imageEntry.k'
                            }
                          }
                        ]
                      }
                    }
                  },
                  as: 'priceEntry',
                  in: {
                    $convert: {
                      input: '$$priceEntry.v',
                      to: 'double',
                      onError: null,
                      onNull: null
                    }
                  }
                }
              }
            ]
          }
        }
      }
    },
    in: {
      $let: {
        vars: {
          validLinkedPrices: {
            $filter: {
              input: '$$linkedPrices',
              as: 'value',
              cond: { $gt: ['$$value', 0] }
            }
          }
        },
        in: {
          $cond: [
            { $gt: [{ $size: '$$validLinkedPrices' }, 0] },
            { $min: '$$validLinkedPrices' },
            {
              $convert: {
                input: '$price',
                to: 'double',
                onError: 0,
                onNull: 0
              }
            }
          ]
        }
      }
    }
  }
});

