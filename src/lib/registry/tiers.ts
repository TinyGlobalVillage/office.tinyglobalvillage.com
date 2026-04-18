import { z } from 'zod';

export const TIER_IDS = ['basic', 'cart'] as const;

export const TierIdSchema = z.enum(TIER_IDS);
export type TierId = z.infer<typeof TierIdSchema>;

export type Tier = {
  id: TierId;
  name: string;
  monthlyUsd: number;
  includes: string[];
};

export const TIERS: Record<TierId, Tier> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    monthlyUsd: 20,
    includes: [
      'Dashboard + page editor',
      '1GB storage',
      'Subdomain on tinyglobalvillage.com (or custom domain)',
      'SSL via Certbot',
      'All @tgv/* shared upgrades',
    ],
  },
  cart: {
    id: 'cart',
    name: 'Basic + Cart',
    monthlyUsd: 30,
    includes: [
      'Everything in Basic',
      'Shopping cart + Stripe checkout',
      'Unlocks Shop and Stripe Connect modules',
    ],
  },
};

export const STORAGE = {
  includedGB: 1,
  maxGB: 10,
  overageUsdPerGB: 1,
} as const;
