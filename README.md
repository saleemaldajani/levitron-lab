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

1. Open [github.com/saldajani/levitron-lab](https://github.com/saldajani/levitron-lab) → **Code** → **Codespaces** → **Create codespace on main**.
2. Wait for `npm install` (`postCreateCommand`), then the dev server starts (`postAttachCommand`).
3. Open the forwarded **port 5173** preview.

Manual start:

```bash
npm run dev -- --host
```

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
```

## Figure capture

```bash
npx playwright install chromium   # first time only
npm run figures                   # Playwright headless capture → paper/figures/
```

See [paper/README.md](paper/README.md) for building PDFs.

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
10. S. Aldajani & Alowayed, MIT 8.223 project report (author's prior work). http://goo.gl/c5u3lk
11. S. Aldajani, Levitron analysis video (author). https://www.youtube.com/watch?v=1LHwq_g06fE

## License

MIT — see [LICENSE](LICENSE).
