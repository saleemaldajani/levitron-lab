export interface Reference {
  id: number;
  text: string;
  url: string;
}

export const REFERENCES: Reference[] = [
  {
    id: 1,
    text: 'MIT VIZ Group, "Physics Behind the Levitron."',
    url: 'https://web.mit.edu/viz/levitron/Physics.html',
  },
  {
    id: 2,
    text: 'MIT VIZ Group, "Levitron — How To."',
    url: 'https://web.mit.edu/viz/levitron/How_To.html',
  },
  {
    id: 3,
    text:
      'Doff, A. & Szmoski, R. M., "Magnetic levitation by rotation described by a new type of Levitron," arXiv:2506.23268.',
    url: 'https://arxiv.org/html/2506.23268v2',
  },
  {
    id: 4,
    text: 'Berkowitz, R., "How Rotation Drives Magnetic Levitation," Physics (APS) 16, 177.',
    url: 'https://physics.aps.org/articles/v16/177',
  },
  {
    id: 5,
    text:
      'Hermansen, J. M. et al., "Magnetic levitation by rotation," Phys. Rev. Applied 20, 044036 (2023).',
    url: 'https://journals.aps.org/prapplied/abstract/10.1103/PhysRevApplied.20.044036',
  },
  {
    id: 6,
    text:
      'Berry, M. V., "The Levitron: an adiabatic trap for spins," Proc. R. Soc. Lond. A 452, 1207–1220 (1996).',
    url: 'https://michaelberryphysics.wordpress.com/wp-content/uploads/2013/07/berry271.pdf',
  },
  {
    id: 7,
    text:
      'Simon, M. D., Heflinger, L. O. & Ridgway, S. L., "Spin stabilized magnetic levitation," Am. J. Phys. 65, 286–292 (1997).',
    url: 'https://www.physics.ucla.edu/marty/levitron/spinstab.pdf',
  },
  {
    id: 8,
    text: '"Spin-stabilized magnetic levitation," Wikipedia.',
    url: 'https://en.wikipedia.org/wiki/Spin-stabilized_magnetic_levitation',
  },
  {
    id: 9,
    text:
      'Personal communication — conversation with Prof. Wolfgang Ketterle (MIT, Nobel Laureate in Physics 2001), June 2026: on the classification of levitating toys by which directions are unstable, gyroscopic stabilization by angular momentum and magnetic force alone, thermal-drift and air-friction failure modes, and the analogy between the gyroscopic Levitron and the magnetic trapping of neutral atoms. Source of the project\'s framing and the closing epigraph.',
    url: '#ref-9',
  },
  {
    id: 10,
    text:
      'Aldajani, S. & Alowayed, "Understanding the Levitron Through the Analysis of a Symmetric Spinning Top in a Gravitational Field," MIT 8.223 Classical Mechanics III project report (author\'s prior work; physics basis for the gyroscopic module).',
    url: 'http://goo.gl/c5u3lk',
  },
  {
    id: 11,
    text:
      'Aldajani, S., demonstration video of the symmetric-top Levitron analysis and interactive simulations (author).',
    url: 'https://www.youtube.com/watch?v=1LHwq_g06fE',
  },
];

export function citeRef(id: number): string {
  return `[${id}]`;
}
