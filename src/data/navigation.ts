import type { NavItem } from '../types';

export const MODULE_NAV: NavItem[] = [
  { id: 'earnshaw', label: 'Earnshaw\'s Theorem', dimension: '0D', shortLabel: 'Earnshaw' },
  { id: 'feedback1d', label: '1D Active Feedback', dimension: '1D', shortLabel: '1D Feedback' },
  { id: 'feedback2d', label: '2D Feedback Levitator', dimension: '2D', shortLabel: '2D Feedback' },
  { id: 'gyroscopic', label: 'Gyroscopic Levitron', dimension: '3D', shortLabel: 'Levitron' },
  { id: 'dynamical', label: 'Dynamical Rotor Levitron', dimension: '3D', shortLabel: 'Rotor' },
];

export const EXTRA_NAV: NavItem[] = [
  { id: 'comparison', label: 'Comparison', dimension: '' },
  { id: 'atom-trap', label: 'From Toy to Atom Trap', dimension: '' },
  { id: 'references', label: 'References', dimension: '' },
];
