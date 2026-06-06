import type { ReactNode } from 'react';

interface PhysicsPanelProps {
  title?: string;
  children: ReactNode;
  experiment?: string;
  citations?: ReactNode;
}

export function PhysicsPanel({ title = "What's happening", children, experiment, citations }: PhysicsPanelProps) {
  return (
    <aside className="physics-panel">
      <h3>{title}</h3>
      <div className="physics-content">{children}</div>
      {experiment && (
        <div className="experiment-box">
          <h4>Try this</h4>
          <p>{experiment}</p>
        </div>
      )}
      {citations && (
        <div className="citations-box">
          <h4>Sources</h4>
          {citations}
        </div>
      )}
    </aside>
  );
}

interface ModuleHeaderProps {
  title: string;
  subtitle: string;
  dimension: string;
  status: ReactNode;
}

export function ModuleHeader({ title, subtitle, dimension, status }: ModuleHeaderProps) {
  return (
    <header className="module-header">
      <div>
        <span className="dimension-tag">{dimension}</span>
        <h2>{title}</h2>
        <p className="module-subtitle">{subtitle}</p>
      </div>
      {status}
    </header>
  );
}
