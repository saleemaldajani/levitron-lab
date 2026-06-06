# The Levitron Lab

Interactive, browser-based physics simulations of magnetic levitation — a set of *scientific toys* that teach how different kinds of levitron work. Each module foregrounds a live, animated hovering object you can perturb with sliders, alongside potential-energy curves, stability gauges, and equations.

The modules climb a dimensionality ladder organized around the three ways physical devices escape **Earnshaw's theorem**:

| Module | Device | Escape route | Unstable directions |
|--------|--------|--------------|---------------------|
| 0 | Earnshaw primer | — | (demonstrates impossibility) |
| 1 | Levitating globe / lamp | active electronic feedback | z only |
| 2 | 4-coil gimbal (PID) | active electronic feedback | x, y |
| 3 | Classic spinning Levitron | gyroscopic spin + magnetic force | full 3D (spin-stabilized) |
| 4 | Dynamical rotor | driven rotation (frequency-lock) | full 3D (driven) |

The classic gyroscopic Levitron (Module 3) is, as Wolfgang Ketterle put it, a tabletop model of how a neutral atom is levitated in a magnetic trap. Module 3 implements the symmetric-top nutation analysis from the author's MIT 8.223 project ([PDF](http://goo.gl/c5u3lk), [video](https://www.youtube.com/watch?v=1LHwq_g06fE)).

## Run it in GitHub Codespaces

The fastest way to try the lab without installing Node locally:

1. Open [github.com/saleemaldajani/levitron-lab](https://github.com/saleemaldajani/levitron-lab) → **Code** → **Codespaces** → **Create codespace on main**.
2. Wait for `npm install` to finish (`.devcontainer` `postCreateCommand`).
3. The dev server starts automatically (`postAttachCommand`: `npm run dev -- --host`).
4. In the **Ports** tab, open the forwarded preview for port **5173**.

Manual restart inside the codespace:

```bash
npm run dev -- --host
```

Production build and preview:

```bash
npm run build
npm run preview -- --host
```

Regenerate manuscript figures (Playwright Chromium required):

```bash
npx playwright install chromium
npm run figures
```

See [paper/README.md](paper/README.md) and Appendix A of `paper/levitron_lab_ajp.tex` for the same instructions.

## Deploy on Railway

The repo includes `railway.toml`, `nixpacks.toml`, and an `npm start` script for a public static deployment.

1. Create a project at [railway.app](https://railway.app) and connect this GitHub repository.
2. Railway runs `npm ci && npm run build`, then `npm start` (serves `dist/` on `$PORT`).
3. Assign a public domain in the Railway dashboard.

Local production test:

```bash
npm run build
PORT=3000 npm start
```

See Appendix B of `paper/levitron_lab_ajp.tex` for deployment details.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Build: `npm run build` · preview: `npm run preview`.

## Project layout

```
.devcontainer/   GitHub Codespaces configuration
docs/            generation prompts (PROMPT + follow-ups)
paper/           PRL-format draft + AJP submission version + figures
src/             React app (modules + physics engines in src/physics/)
railway.toml     Railway deploy config
```

## Figure capture

```bash
npx playwright install chromium   # first time only
npm run figures                   # Playwright headless capture → paper/figures/
```

See [paper/README.md](paper/README.md) for building PDFs.

## Cite

Placeholder BibTeX (update when the paper is published):

```bibtex
@misc{aldajani2026levitronlab,
  author       = {Al Dajani, Saleem A.},
  title        = {The Levitron Lab: An Interactive Curriculum for Magnetic Levitation Physics},
  year         = {2026},
  howpublished = {Interactive web application and accompanying manuscript},
  note         = {Paper forthcoming. See paper/ in this repository.},
  url          = {https://github.com/saleemaldajani/levitron-lab}
}
```

Full entry: [CITATION.bib](CITATION.bib).

## References

1. MIT VIZ Group, "Physics Behind the Levitron." https://web.mit.edu/viz/levitron/Physics.html
2. MIT VIZ Group, "Levitron — How To." https://web.mit.edu/viz/levitron/How_To.html
3. A. Doff & R. M. Szmoski, arXiv:2506.23268. https://arxiv.org/html/2506.23268v2
4. R. Berkowitz, Physics (APS) 16, 177. https://physics.aps.org/articles/v16/177
5. J. M. Hermansen et al., Phys. Rev. Applied 20, 044036 (2023). https://journals.aps.org/prapplied/abstract/10.1103/PhysRevApplied.20.044036
6. M. V. Berry, Proc. R. Soc. Lond. A 452, 1207 (1996). https://michaelberryphysics.wordpress.com/wp-content/uploads/2013/07/berry271.pdf
7. M. D. Simon, L. O. Heflinger & S. L. Ridgway, Am. J. Phys. 65, 286 (1997). https://www.physics.ucla.edu/marty/levitron/spinstab.pdf
8. Spin-stabilized magnetic levitation, Wikipedia. https://en.wikipedia.org/wiki/Spin-stabilized_magnetic_levitation
9. W. Ketterle, personal communication (MIT, June 2026).
10. S. A. Al Dajani & Alowayed, MIT 8.223 project report (author's prior work). http://goo.gl/c5u3lk
11. S. A. Al Dajani, Levitron analysis video (author). https://www.youtube.com/watch?v=1LHwq_g06fE

## License

MIT — see [LICENSE](LICENSE).
