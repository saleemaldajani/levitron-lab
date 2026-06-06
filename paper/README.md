# Papers

Two LaTeX versions live here:

| File | Format | Purpose |
|------|--------|---------|
| `levitron_lab_prl.tex` | PRL two-column (RevTeX `prl`) | arXiv / quick circulation draft |
| `levitron_lab_ajp.tex` | AJP full article (`aapm,ajp`) | **Journal submission version** (American Journal of Physics) |

## Figures

Figures are captured from the running webapp into `figures/` using Playwright (headless Chromium):

```bash
npm install
npx playwright install chromium   # first time only; stored in .playwright-browsers/
npm run build
npm run figures
```

Expected files:

- `fig_earnshaw_saddle.png`
- `fig_feedback1d_globe.png`, `fig_feedback1d_eigs.png`
- `fig_feedback2d_topview.png`, `fig_feedback2d_eigs.png`
- `fig_gyro_stable.png`, `fig_gyro_potential.png`, `fig_gyro_theta_trace.png`
- `fig_rotor_trap.png`, `fig_rotor_potential.png`

Each module also has an in-app **Save figure** button (Module 3) or canvas export for manual capture.

## Build PDFs

Requires a TeX installation with `revtex4-2` (e.g. `tlmgr install revtex`).

```bash
./paper/build.sh
```

Or manually from `paper/`:

```bash
pdflatex levitron_lab_prl.tex && pdflatex levitron_lab_prl.tex
pdflatex levitron_lab_ajp.tex && pdflatex levitron_lab_ajp.tex
```

Outputs: `levitron_lab_prl.pdf`, `levitron_lab_ajp.pdf`.

## Repository

https://github.com/saldajani/levitron-lab
