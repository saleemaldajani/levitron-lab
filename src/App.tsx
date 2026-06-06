import { useEffect, useState, type ReactNode } from 'react';
import { Layout } from './components/Layout';
import { Module0Earnshaw } from './modules/Module0Earnshaw';
import { Module1Feedback1D } from './modules/Module1Feedback1D';
import { Module2Feedback2D } from './modules/Module2Feedback2D';
import { Module3Gyroscopic } from './modules/Module3Gyroscopic';
import { Module4Dynamical } from './modules/Module4Dynamical';
import { AtomTrapPage } from './pages/AtomTrapPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { ReferencesPage } from './pages/ReferencesPage';
import type { PageId } from './types';

const PAGE_IDS: PageId[] = [
  'earnshaw', 'feedback1d', 'feedback2d', 'gyroscopic', 'dynamical',
  'comparison', 'atom-trap', 'references',
];

function pageFromHash(): PageId {
  const h = window.location.hash.replace('#', '');
  if (h.startsWith('ref-')) return 'references';
  const page = h.split('/')[0] as PageId;
  return PAGE_IDS.includes(page) ? page : 'earnshaw';
}

const PAGES: Record<PageId, ReactNode> = {
  earnshaw: <Module0Earnshaw />,
  feedback1d: <Module1Feedback1D />,
  feedback2d: <Module2Feedback2D />,
  gyroscopic: <Module3Gyroscopic />,
  dynamical: <Module4Dynamical />,
  comparison: <ComparisonPage />,
  'atom-trap': <AtomTrapPage />,
  references: <ReferencesPage />,
};

export default function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (id: PageId) => {
    window.location.hash = id;
    setPage(id);
  };

  return (
    <Layout currentPage={page} onNavigate={navigate}>
      {PAGES[page]}
    </Layout>
  );
}
