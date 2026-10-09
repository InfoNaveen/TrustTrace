'use client';

// ============================================================
// StatusBadge — reusable verdict/status pill
// ============================================================

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CLASSES: Record<string, string> = {
  running: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  blocked: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  attack_succeeded: 'bg-red-500/10 text-red-400 border-red-500/20',
  passed: 'bg-green-500/10 text-green-400 border-green-500/20',
  inconclusive: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  allow: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  deny: 'bg-red-500/10 text-red-400 border-red-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  denied: 'bg-red-500/10 text-red-400 border-red-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const DEFAULT_CLASSES = 'bg-gray-500/10 text-gray-400 border-gray-500/20';

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colorClasses = STATUS_CLASSES[status] ?? DEFAULT_CLASSES;

  const sizeClasses =
    size === 'md'
      ? 'text-sm py-1 px-3'
      : 'text-xs py-0.5 px-2.5';

  return (
    <span
      className={`inline-flex leading-4 font-semibold rounded-full border ${sizeClasses} ${colorClasses}`}
    >
      {status}
    </span>
  );
}
