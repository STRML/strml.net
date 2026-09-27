STRML.net
=========

[View Site](http://strml.net)

Building
--------

```bash
git clone git@github.com:STRML/strml.net.git
cd strml.net
npm install
npm run dev
# Open localhost:4003/index-dev.html in your browser
```

Building for Production
--------

```bash
npm run build
```

Age of AI edition
--------

`ai.html` is a second take on the same idea: a stylesheet that types itself, but it builds
a sci-fi instrument panel (specimen plot, timeline, telemetry, keyboard, an eye) as it goes.
The chapters live in `ai/styles*.css`; the instruments are in `ai.js`. Add `?speed=0` to the
URL to fast-forward.

Note: on Node 17+, webpack 5.36 needs `NODE_OPTIONS=--openssl-legacy-provider`.
