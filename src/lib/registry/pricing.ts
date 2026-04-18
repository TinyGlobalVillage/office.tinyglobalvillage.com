import { MODULES, type ModuleId } from './modules';
import { TIERS, STORAGE } from './tiers';
import type { TierId } from './tiers';
import type { ClientSpec } from './types';

export type PriceBreakdown = {
  monthlyUsd: number;
  oneTimeUsd: number;
  detail: {
    tier: { id: TierId; monthlyUsd: number };
    storage: { gb: number; overageGB: number; monthlyUsd: number };
    modules: Array<{ id: ModuleId; oneTimeUsd: number }>;
  };
};

export function getPrice(
  spec: Pick<ClientSpec, 'tier' | 'modules' | 'storageGB'>,
): PriceBreakdown {
  const tier = TIERS[spec.tier];
  const overageGB = Math.max(0, spec.storageGB - STORAGE.includedGB);
  const storageMonthly = overageGB * STORAGE.overageUsdPerGB;

  const moduleDetails = spec.modules.map((id) => ({
    id,
    oneTimeUsd: MODULES[id].oneTimeFeeUsd,
  }));
  const oneTimeUsd = moduleDetails.reduce((s, m) => s + m.oneTimeUsd, 0);

  return {
    monthlyUsd: tier.monthlyUsd + storageMonthly,
    oneTimeUsd,
    detail: {
      tier: { id: tier.id, monthlyUsd: tier.monthlyUsd },
      storage: { gb: spec.storageGB, overageGB, monthlyUsd: storageMonthly },
      modules: moduleDetails,
    },
  };
}

export function validateModuleCompatibility(
  spec: Pick<ClientSpec, 'tier' | 'modules'>,
): { ok: true } | { ok: false; reason: string; offending: string[] } {
  const offending = spec.modules.filter((id) => {
    const req = MODULES[id].requiresTier;
    return req && req !== spec.tier && spec.tier !== 'cart';
  });
  if (offending.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `Modules require cart tier: ${offending.join(', ')}`,
    offending,
  };
}
