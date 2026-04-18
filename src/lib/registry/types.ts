import { z } from 'zod';
import { VerticalIdSchema } from './verticals';
import { ModuleIdSchema } from './modules';
import { TierIdSchema } from './tiers';
import { STORAGE } from './tiers';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const ClientContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

export const BrandingSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR).optional(),
  accentColor: z.string().regex(HEX_COLOR).optional(),
  logoUrl: z.string().url().optional(),
});

export const ClientSpecSchema = z.object({
  clientName: z.string().min(1),
  domain: z.string().min(3),
  subdomain: z.string().min(1).optional(),
  vertical: VerticalIdSchema,
  tier: TierIdSchema,
  modules: z.array(ModuleIdSchema).default([]),
  storageGB: z.number().int().min(STORAGE.includedGB).max(STORAGE.maxGB),
  customFlag: z.boolean().default(false),
  customDescription: z.string().optional(),
  contact: ClientContactSchema,
  branding: BrandingSchema.optional(),
}).refine(
  (s) => !s.customFlag || (s.customDescription && s.customDescription.length > 0),
  { message: 'customDescription is required when customFlag is true', path: ['customDescription'] },
);

export type ClientSpec = z.infer<typeof ClientSpecSchema>;

export const DEPLOY_STATUSES = ['pending', 'deploying', 'live', 'failed'] as const;
export const DeployStatusSchema = z.enum(DEPLOY_STATUSES);
export type DeployStatus = z.infer<typeof DeployStatusSchema>;

export type DeployResult = {
  status: DeployStatus;
  subdomain?: string;
  repoUrl?: string;
  pm2Name?: string;
  log?: string;
  error?: string;
};
