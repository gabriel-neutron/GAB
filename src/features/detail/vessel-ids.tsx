import { CAPTION, DATA } from './style';
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
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {parts.map((part) => (
        <span key={part.key} data-vessel-id={part.key} className="text-body-sm text-label">
          <span className={CAPTION}>{`${part.label} `}</span>
          {part.value === null ? (
            NOT_RECORDED
          ) : (
            <span className={part.figure ? `${DATA} text-foreground` : 'text-foreground'}>
              {part.value}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
