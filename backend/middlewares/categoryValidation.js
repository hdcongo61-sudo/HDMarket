import Joi from 'joi';
import { validate } from './validate.js';

const objectId = Joi.string().hex().length(24);

export const categorySchemas = {
  idParam: Joi.object({
    id: objectId.required()
  }),
  treeQuery: Joi.object({
    country: Joi.string().trim().allow('', null),
    city: Joi.string().trim().allow('', null),
    includeInactive: Joi.boolean().truthy('true').falsy('false').default(false),
    includeDeleted: Joi.boolean().truthy('true').falsy('false').default(false),
    search: Joi.string().trim().allow('', null)
  }),
  create: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    slug: Joi.string().trim().lowercase().max(140).allow('', null),
    parentId: objectId.allow(null, ''),
    order: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
    iconKey: Joi.string().trim().max(120).allow('', null),
    imageUrl: Joi.string().uri().allow('', null),
    description: Joi.string().trim().max(1200).allow('', null),
    country: Joi.string().trim().max(12).allow('', null),
    cities: Joi.array().items(Joi.string().trim().max(120)).max(200).default([])
  }),
  update: Joi.object({
    name: Joi.string().trim().min(2).max(120),
    slug: Joi.string().trim().lowercase().max(140).allow('', null),
    parentId: objectId.allow(null, ''),
    order: Joi.number().integer().min(0),
    isActive: Joi.boolean(),
    iconKey: Joi.string().trim().max(120).allow('', null),
    imageUrl: Joi.string().uri().allow('', null),
    description: Joi.string().trim().max(1200).allow('', null),
    country: Joi.string().trim().max(12).allow('', null),
    cities: Joi.array().items(Joi.string().trim().max(120)).max(200),
    reason: Joi.string().trim().max(300).allow('', null)
  }).min(1),
  softDelete: Joi.object({
    force: Joi.boolean().default(false),
    reassignTargetId: objectId.allow(null, ''),
    reason: Joi.string().trim().max(300).allow('', null)
  }),
  restore: Joi.object({
    reason: Joi.string().trim().max(300).allow('', null)
  }),
  reorder: Joi.object({
    allowParentChange: Joi.boolean().default(false),
    items: Joi.array()
      .min(1)
      .items(
        Joi.object({
          id: objectId.required(),
          parentId: objectId.allow(null, ''),
          order: Joi.number().integer().min(0).required()
        })
      )
      .required()
  }),
  reassignProducts: Joi.object({
    sourceId: objectId.required(),
    targetId: objectId.required(),
    includeChildren: Joi.boolean().default(true),
    reason: Joi.string().trim().max(300).allow('', null)
  }),
  exportQuery: Joi.object({
    format: Joi.string().valid('json', 'csv').default('json'),
    country: Joi.string().trim().allow('', null),
    includeDeleted: Joi.boolean().truthy('true').falsy('false').default(false)
  }),
  importQuery: Joi.object({
    dryRun: Joi.boolean().truthy('true').falsy('false').default(true)
  }),
  importBody: Joi.object({
    country: Joi.string().trim().allow('', null),
    nodes: Joi.array().items(Joi.object()).min(1),
    tree: Joi.array().items(Joi.object()).min(1)
  }).xor('nodes', 'tree'),
  auditQuery: Joi.object({
    entityId: objectId.allow('', null),
    action: Joi.string()
      .valid('CREATE', 'UPDATE', 'REORDER', 'SOFT_DELETE', 'RESTORE', 'IMPORT', 'REASSIGN')
      .allow('', null),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    from: Joi.date().iso().allow('', null),
    to: Joi.date().iso().allow('', null)
  })
};

export const validateCategory = {
  idParam: validate(categorySchemas.idParam, 'params'),
  treeQuery: validate(categorySchemas.treeQuery, 'query'),
  create: validate(categorySchemas.create),
  update: validate(categorySchemas.update),
  softDelete: validate(categorySchemas.softDelete),
  restore: validate(categorySchemas.restore),
  reorder: validate(categorySchemas.reorder),
  reassignProducts: validate(categorySchemas.reassignProducts),
  exportQuery: validate(categorySchemas.exportQuery, 'query'),
  importQuery: validate(categorySchemas.importQuery, 'query'),
  importBody: validate(categorySchemas.importBody),
  auditQuery: validate(categorySchemas.auditQuery, 'query')
};

