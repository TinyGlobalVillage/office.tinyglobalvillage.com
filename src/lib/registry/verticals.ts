import { z } from 'zod';
import type { ModuleId } from './modules';
import type { TierId } from './tiers';

export const VERTICAL_IDS = [
  'blogger',
  'coach',
  'yoga',
  'psychic',
  'teacher',
  'ecommerce',
  'custom',
] as const;

export const VerticalIdSchema = z.enum(VERTICAL_IDS);
export type VerticalId = z.infer<typeof VerticalIdSchema>;

export type Vertical = {
  id: VerticalId;
  name: string;
  tagline: string;
  defaultModules: ModuleId[];
  defaultTier: TierId;
};

export const VERTICALS: Record<VerticalId, Vertical> = {
  blogger: {
    id: 'blogger',
    name: 'Blogger',
    tagline: 'Writing-first personal site with blog + subscribers.',
    defaultModules: ['blog', 'subscribers'],
    defaultTier: 'basic',
  },
  coach: {
    id: 'coach',
    name: 'Coach',
    tagline: 'Bookable one-on-one coaching with appointments + payments.',
    defaultModules: ['appointments', 'subscribers', 'reviews'],
    defaultTier: 'basic',
  },
  yoga: {
    id: 'yoga',
    name: 'Yoga Studio',
    tagline: 'Class schedule, live streams, and member appointments.',
    defaultModules: ['appointments', 'streaming', 'subscribers'],
    defaultTier: 'cart',
  },
  psychic: {
    id: 'psychic',
    name: 'Psychic / Human Design Reader',
    tagline: 'HD charts + bookable readings + subscribers.',
    defaultModules: ['humandesign', 'appointments', 'subscribers'],
    defaultTier: 'basic',
  },
  teacher: {
    id: 'teacher',
    name: 'Teacher / Course Creator',
    tagline: 'Course library + student reviews + subscribers.',
    defaultModules: ['courses', 'reviews', 'subscribers'],
    defaultTier: 'cart',
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce',
    tagline: 'Shop with cart + subscribers + reviews.',
    defaultModules: ['shop', 'reviews', 'subscribers'],
    defaultTier: 'cart',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    tagline: 'Start from the base; RFP will scope bespoke work.',
    defaultModules: [],
    defaultTier: 'basic',
  },
};
