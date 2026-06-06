import { useEffect } from 'react';
import { REFERENCES } from '../data/references';

function scrollToRefFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash.startsWith('ref-')) return;
  document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ReferencesPage() {
  useEffect(() => {
    scrollToRefFromHash();
    window.addEventListener('hashchange', scrollToRefFromHash);
    return () => window.removeEventListener('hashchange', scrollToRefFromHash);
  }, []);

  return (
    <div className="module static-page" id="references">
      <header className="module-header">
        <div>
          <h2>References</h2>
          <p className="module-subtitle">Sources cited throughout the exhibits.</p>
        </div>
      </header>

      <ol className="reference-list" start={1}>
        {REFERENCES.map((ref) => (
          <li key={ref.id} id={`ref-${ref.id}`}>
            <span className="ref-num">[{ref.id}]</span>{' '}
            <span className="ref-text">{ref.text}</span>{' '}
            {ref.url.startsWith('#') ? (
              <span className="ref-url">{ref.url}</span>
            ) : (
              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="ref-link">
                {ref.linkLabel ?? ref.url}
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
