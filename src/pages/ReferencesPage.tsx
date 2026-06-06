import { REFERENCES } from '../data/references';

export function ReferencesPage() {
  return (
    <div className="module static-page" id="references">
      <header className="module-header">
        <div>
          <h2>References</h2>
          <p className="module-subtitle">Sources cited throughout the exhibits.</p>
        </div>
      </header>

      <ol className="reference-list">
        {REFERENCES.map((ref) => (
          <li key={ref.id} id={`ref-${ref.id}`}>
            <span className="ref-text">{ref.text}</span>{' '}
            {ref.url.startsWith('#') ? (
              <span className="ref-url">{ref.url}</span>
            ) : (
              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="ref-link">
                {ref.url}
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
