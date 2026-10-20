import { cn } from '@/shared/lib/utils';

import type { VesselIdentity } from './vessel-identity';

export interface VesselIdsProps {
  readonly identity: VesselIdentity;
}

const NOT_RECORDED = 'not recorded';

/** The flag, the MMSI and the call sign of a vessel, under its name. A value that the record does
 * not hold reads "not recorded". */
export function VesselIds({ identity }: VesselIdsProps) {
  const parts = [
    { key: 'flag', label: 'Flag', value: identity.flag, figure: false },
    { key: 'mmsi', label: 'MMSI', value: identity.mmsi, figure: true },
    { key: 'call-sign', label: 'Call sign', value: identity.callSign, figure: true },
  ];
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 text-small/4 text-label">
      {parts.map((part) => (
        <span key={part.key} data-vessel-id={part.key}>
          {`${part.label} `}
          {part.value === null ? (
            NOT_RECORDED
          ) : (
            <span className={cn('text-foreground', part.figure && 'font-mono tabular-nums')}>
              {part.value}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
