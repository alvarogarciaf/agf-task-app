import { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema, toTypedRxJsonSchema } from 'rxdb';
import type { Task, Project, Person, Context } from '../types';

export const taskSchemaLiteral = {
  title: 'task schema',
  version: 5,
  description: 'describes a task or note (unified object)',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    type: { type: 'string', enum: ['task', 'note'], default: 'task' },
    description: { type: 'string' },
    details: { type: ['string', 'null'] },
    date_created: { type: 'string' },
    show_on: { type: ['string', 'null'] },
    action_date: { type: ['string', 'null'] },
    project_id: { type: ['string', 'null'] },
    person_id: { type: ['string', 'null'] },
    context_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    tag_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    processed: { type: 'boolean', default: false },
    status: { type: 'string', enum: ['Open', 'Done'], default: 'Open' },
    urgency_id: { type: 'string' },
    archived: { type: 'boolean', default: false },
    google_event_id: { type: ['string', 'null'] },
  },
  required: ['id', 'description', 'date_created', 'context_ids', 'processed', 'status', 'urgency_id'],
  indexes: ['date_created', 'processed'],
} as const;

export const taskSchemaTyped = toTypedRxJsonSchema(taskSchemaLiteral);
export type TaskDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof taskSchemaTyped>;

export const urgencySchemaLiteral = {
  title: 'urgency schema',
  version: 0,
  description: 'describes an urgency level',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    color: { type: 'string' },
    order: { type: 'number' },
  },
  required: ['id', 'name', 'color', 'order'],
} as const;
export const urgencySchemaTyped = toTypedRxJsonSchema(urgencySchemaLiteral);
export type UrgencyDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof urgencySchemaTyped>;

export const projectSchemaLiteral = {
  title: 'project schema',
  version: 3,
  description: 'describes a project',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    details: { type: ['string', 'null'] },
    status: {
      type: 'string',
      enum: ['Ongoing', 'Closed'],
    },
    linked_person_id: { type: ['string', 'null'] },
    icon: { type: ['string', 'null'] },
    color: { type: ['string', 'null'] },
  },
  required: ['id', 'name', 'status'],
} as const;
export const projectSchemaTyped = toTypedRxJsonSchema(projectSchemaLiteral);
export type ProjectDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof projectSchemaTyped>;

export const personSchemaLiteral = {
  title: 'person schema',
  version: 2,
  description: 'describes a person',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    initials: { type: 'string' },
    color: { type: 'string' },
    linked_uid: { type: ['string', 'null'] },
    linked_email: { type: ['string', 'null'] },
    pending_invite_email: { type: ['string', 'null'] },
  },
  required: ['id', 'name', 'initials', 'color'],
} as const;
export const personSchemaTyped = toTypedRxJsonSchema(personSchemaLiteral);
export type PersonDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof personSchemaTyped>;

export const contextSchemaLiteral = {
  title: 'context schema',
  version: 0,
  description: 'describes a context',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    icon: { type: 'string' },
    color: { type: 'string' },
  },
  required: ['id', 'name', 'icon', 'color'],
} as const;
export const contextSchemaTyped = toTypedRxJsonSchema(contextSchemaLiteral);
export type ContextDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof contextSchemaTyped>;

export const tagSchemaLiteral = {
  title: 'tag schema',
  version: 0,
  description: 'describes a tag',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    icon: { type: 'string' },
    color: { type: 'string' },
  },
  required: ['id', 'name', 'icon', 'color'],
} as const;
export const tagSchemaTyped = toTypedRxJsonSchema(tagSchemaLiteral);
export type TagDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof tagSchemaTyped>;

export const savedViewSchemaLiteral = {
  title: 'saved view schema',
  version: 3,
  description: 'describes a saved view',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    icon: { type: 'string' },
    color: { type: 'string' },
    context_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    project_id: { type: ['string', 'null'] },
    person_id: { type: ['string', 'null'] },
    show_status: { type: 'string', enum: ['all', 'open', 'done'] },
    is_grouped_by_project: { type: 'boolean' },
    show_hidden_by_show_on: { type: 'boolean' },
    sort_key: { type: 'string' },
    sort_direction: { type: 'string', enum: ['asc', 'desc'] },
    date_created: { type: 'string' },
    order: { type: 'number' },
  },
  required: ['id', 'name', 'icon', 'color', 'context_ids', 'show_status', 'is_grouped_by_project', 'show_hidden_by_show_on', 'sort_key', 'sort_direction', 'date_created', 'order'],
} as const;
export const savedViewSchemaTyped = toTypedRxJsonSchema(savedViewSchemaLiteral);
export type SavedViewDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof savedViewSchemaTyped>;

export const DatabaseCollections = {
  tasks: { schema: taskSchemaLiteral },
  urgencies: { schema: urgencySchemaLiteral },
  projects: { schema: projectSchemaLiteral },
  persons: { schema: personSchemaLiteral },
  contexts: { schema: contextSchemaLiteral },
  tags: { schema: tagSchemaLiteral },
  saved_views: { schema: savedViewSchemaLiteral },
};
