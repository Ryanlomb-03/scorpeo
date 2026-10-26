import { 
  AlertTriangle, 
  Info, 
  CircleCheck, 
  CircleX, 
  Lightbulb, 
  ArrowRight,
  ShieldAlert,
  Skull,
  StickyNote,
  Ban,
  Zap
} from 'lucide-react';

interface SemanticMarkerProps {
  type: 'warning' | 'info' | 'success' | 'error' | 'tip' | 'arrow' | 'danger' | 'caution' | 'note' | 'fatal' | 'ban' | 'zap';
  children?: React.ReactNode;
}

export function SemanticMarker({ type, children }: SemanticMarkerProps) {
  const icons = {
    danger: <ShieldAlert className="w-4 h-4 inline-block mr-1.5 text-rose-500 animate-pulse" />,
    fatal: <Skull className="w-4 h-4 inline-block mr-1.5 text-red-600" />,
    caution: <AlertTriangle className="w-4 h-4 inline-block mr-1.5 text-amber-400" />,
    warning: <AlertTriangle className="w-4 h-4 inline-block mr-1.5 text-yellow-400" />,
    note: <StickyNote className="w-4 h-4 inline-block mr-1.5 text-indigo-400" />,
    info: <Info className="w-4 h-4 inline-block mr-1.5 text-sky-400" />,
    success: <CircleCheck className="w-4 h-4 inline-block mr-1.5 text-emerald-400" />,
    error: <CircleX className="w-4 h-4 inline-block mr-1.5 text-red-500" />,
    tip: <Lightbulb className="w-4 h-4 inline-block mr-1.5 text-amber-300" />,
    arrow: <ArrowRight className="w-4 h-4 inline-block mr-1.5 text-neutral-400" />,
    ban: <Ban className="w-4 h-4 inline-block mr-1.5 text-rose-500" />,
    zap: <Zap className="w-4 h-4 inline-block mr-1.5 text-amber-400" />,
  };

  return (
    <span className="inline-flex items-center">
      {icons[type]}
      {children}
    </span>
  );
}

interface StepNumberProps {
  number: number;
}

export function StepNumber({ number }: StepNumberProps) {
  return (
    <span className="step-number inline-flex items-center justify-center w-6 h-6 border border-current rounded-md text-xs font-semibold mr-2 text-neutral-300">
      {number}
    </span>
  );
}
