import { useEffect, useRef } from 'react';
import katex from 'katex';

interface KatexBlockProps {
  math: string;
  display?: boolean;
  className?: string;
}

export function KatexBlock({ math, display = false, className = '' }: KatexBlockProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(math, ref.current, {
        displayMode: display,
        throwOnError: false,
        trust: true,
      });
    }
  }, [math, display]);

  return <span ref={ref} className={className} />;
}

interface CiteLinkProps {
  id: number;
}

export function CiteLink({ id }: CiteLinkProps) {
  return (
    <a href={`#ref-${id}`} className="cite-link">
      [{id}]
    </a>
  );
}
