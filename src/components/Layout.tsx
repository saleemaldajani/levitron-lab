import type { ReactNode } from 'react';
import type { PageId } from '../types';
import { MODULE_NAV, EXTRA_NAV } from '../data/navigation';
import { Footer } from './Footer';

interface LayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

export function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button type="button" className="site-title" onClick={() => onNavigate('earnshaw')}>
            <span className="title-main">The Levitron Lab</span>
            <span className="title-sub">Interactive magnetic levitation exhibits</span>
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="side-nav" aria-label="Module navigation">
          <div className="nav-section">
            <span className="nav-section-label">Curriculum</span>
            {MODULE_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-dim">{item.dimension}</span>
                <span className="nav-label">{item.shortLabel ?? item.label}</span>
              </button>
            ))}
          </div>
          <div className="nav-section">
            <span className="nav-section-label">Explore</span>
            {EXTRA_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <nav className="top-tabs" aria-label="Mobile navigation">
          {[...MODULE_NAV, ...EXTRA_NAV].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.shortLabel ?? item.label}
            </button>
          ))}
        </nav>

        <main className="main-content">{children}</main>
      </div>

      <Footer />
    </div>
  );
}
