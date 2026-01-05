import mongoose from 'mongoose';

export const buildIdentifierQuery = (identifier) => {
  if (!identifier) return {};
  return mongoose.Types.ObjectId.isValid(identifier) ? { _id: identifier } : { slug: identifier };
};

export const findByIdentifier = async (Model, identifier) => {
  if (!Model || !identifier) return null;
  const query = buildIdentifierQuery(identifier);
  return Model.findOne(query);
};
