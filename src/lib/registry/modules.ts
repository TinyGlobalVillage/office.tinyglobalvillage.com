import { z } from 'zod';

export const MODULE_IDS = [
  'blog',
  'shop',
  'appointments',
  'courses',
  'streaming',
  'humandesign',
  'reviews',
  'subscribers',
  'support',
  'connect',
] as const;

export const ModuleIdSchema = z.enum(MODULE_IDS);
export type ModuleId = z.infer<typeof ModuleIdSchema>;

export type Module = {
  id: ModuleId;
  name: string;
  summary: string;
  tgvPackage: string | null;
  oneTimeFeeUsd: number;
  requiresTier?: 'basic' | 'cart';
};

export const MODULES: Record<ModuleId, Module> = {
  blog: {
    id: 'blog',
    name: 'Blog',
    summary: 'Writing surface with drafts, categories, and subscriber digest hook.',
    tgvPackage: null,
    oneTimeFeeUsd: 49,
  },
  shop: {
    id: 'shop',
    name: 'Shop',
    summary: 'Product catalog + cart + Stripe checkout.',
    tgvPackage: null,
    oneTimeFeeUsd: 149,
    requiresTier: 'cart',
  },
  appointments: {
    id: 'appointments',
    name: 'Appointments',
    summary: 'Bookable calendar, availability rules, and Stripe-backed deposits.',
    tgvPackage: '@tgv/module-appointments',
    oneTimeFeeUsd: 99,
  },
  courses: {
    id: 'courses',
    name: 'Courses',
    summary: 'Instructor kit: lessons, progress tracking, enrollment.',
    tgvPackage: null,
    oneTimeFeeUsd: 149,
  },
  streaming: {
    id: 'streaming',
    name: 'Streaming',
    summary: 'LiveKit-backed broadcasts, greenroom, recordings.',
    tgvPackage: '@tgv/module-video-streaming',
    oneTimeFeeUsd: 199,
  },
  humandesign: {
    id: 'humandesign',
    name: 'Human Design',
    summary: 'HD charts, type-driven personalization, reader tooling.',
    tgvPackage: '@tgv/module-humandesign',
    oneTimeFeeUsd: 99,
  },
  reviews: {
    id: 'reviews',
    name: 'Reviews',
    summary: 'Testimonials with moderation, public + private.',
    tgvPackage: '@tgv/module-reviews',
    oneTimeFeeUsd: 29,
  },
  subscribers: {
    id: 'subscribers',
    name: 'Subscribers',
    summary: 'Email list, double-opt-in, unsubscribe flow.',
    tgvPackage: '@tgv/module-subscribers',
    oneTimeFeeUsd: 29,
  },
  support: {
    id: 'support',
    name: 'Support',
    summary: 'Contact + ticketing routed through admin email.',
    tgvPackage: '@tgv/module-support',
    oneTimeFeeUsd: 29,
  },
  connect: {
    id: 'connect',
    name: 'Stripe Connect',
    summary: 'Marketplace payouts + KYC for client-of-client revenue splits.',
    tgvPackage: '@tgv/module-connect',
    oneTimeFeeUsd: 99,
    requiresTier: 'cart',
  },
};
