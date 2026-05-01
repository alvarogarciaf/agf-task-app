import { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema, toTypedRxJsonSchema } from 'rxdb';
import type { Task, Project, Person, Context } from '../types';

export const taskSchemaLiteral = {
  title: 'task schema',
  version: 0,
  description: 'describes a task',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    details: { type: 'string' },
    date_created: { type: 'string' },
    show_on: { type: ['string', 'null'] },
    action_date: { type: ['string', 'null'] },
    project_id: { type: ['string', 'null'] },
    person_id: { type: ['string', 'null'] },
    context_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    processed: { type: 'boolean', default: false },
    urgency_id: { type: 'string' },
  },
  required: ['id', 'description', 'date_created', 'context_ids', 'processed', 'urgency_id'],
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
  version: 0,
  description: 'describes a project',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    details: { type: 'string' },
    status: {
      type: 'string',
      enum: ['Ongoing', 'Closed'],
    },
  },
  required: ['id', 'name', 'status'],
} as const;
export const projectSchemaTyped = toTypedRxJsonSchema(projectSchemaLiteral);
export type ProjectDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof projectSchemaTyped>;

export const personSchemaLiteral = {
  title: 'person schema',
  version: 0,
  description: 'describes a person',
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    initials: { type: 'string' },
    color: { type: 'string' },
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

export const DatabaseCollections = {
  tasks: { schema: taskSchemaLiteral },
  urgencies: { schema: urgencySchemaLiteral },
  projects: { schema: projectSchemaLiteral },
  persons: { schema: personSchemaLiteral },
  contexts: { schema: contextSchemaLiteral },
};
