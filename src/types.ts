export type StabilityStatus = 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF';

export type PageId =
  | 'earnshaw'
  | 'feedback1d'
  | 'feedback2d'
  | 'gyroscopic'
  | 'dynamical'
  | 'comparison'
  | 'atom-trap'
  | 'references';

export interface NavItem {
  id: PageId;
  label: string;
  dimension: string;
  shortLabel?: string;
}

export interface CitationRef {
  id: number;
  label: string;
}
