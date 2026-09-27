STRML.net
=========

[View Site](https://strml.net) · [Age of AI edition](https://strml.net/ai.html)

Building
--------

Requires Node 20 or newer.

```bash
git clone git@github.com:STRML/strml.net.git
cd strml.net
npm install
npm run dev
# Open localhost:4003 in your browser
```

Building for Production
--------

```bash
npm run build
```

The bundles land in `dist/`, which is not committed.

Deploying
--------

Every push to `master` deploys the site. The `Deploy to GitHub Pages` workflow in
`.github/workflows/deploy.yml` runs `npm run build` and publishes the static files to
GitHub Pages.

Age of AI edition
--------

[`ai.html`](https://strml.net/ai.html) is a second take on the same idea: a stylesheet that
types itself, but it builds a sci-fi instrument panel (specimen plot, timeline, telemetry,
keyboard, an eye) as it goes. The chapters live in `ai/styles*.css`; the instruments are in
`ai.js`. Add `?speed=0` to the URL to fast-forward.
