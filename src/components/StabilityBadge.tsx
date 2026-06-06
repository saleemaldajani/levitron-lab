import type { StabilityStatus } from '../types';

interface StabilityBadgeProps {
  status: StabilityStatus;
}

const LABELS: Record<StabilityStatus, string> = {
  LEVITATING: 'Levitating',
  DRIFTING: 'Drifting',
  CRASHED: 'Crashed',
  'FLEW_OFF': 'Flew Off',
};

export function StabilityBadge({ status }: StabilityBadgeProps) {
  return (
    <div className={`stability-badge status-${status.toLowerCase().replace('_', '-')}`}>
      <span className="status-dot" />
      <span className="status-label">{LABELS[status]}</span>
    </div>
  );
}
