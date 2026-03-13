# Contributing to ChargeFleet

Thanks for your interest in contributing to ChargeFleet!

## Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/notjbg/ev-charger-map.git
   cd ev-charger-map
   ```

2. Install dev dependencies (only needed for tests/linting — the app itself has no build step):
   ```bash
   npm install
   ```

3. Open `index.html` in a browser to run the app locally.

## Development

### Architecture

ChargeFleet is a single-file web application (`index.html`). This is intentional — it enables zero-build deployment and keeps the project simple.

Core logic functions are mirrored in `src/logic.js` for testability. If you change filter logic, data processing, or utility functions in `index.html`, please update the corresponding functions in `src/logic.js` and add tests.

### Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

### Linting & Formatting

```bash
npm run lint          # ESLint
npm run format:check  # Prettier check
npm run format        # Prettier auto-fix
```

### CI

All PRs run lint, format check, and tests via GitHub Actions. Please ensure these pass before requesting review.

## Guidelines

- **Keep it simple.** Prefer straightforward solutions over clever abstractions.
- **Escape all dynamic content** using `escHtml()` to prevent XSS.
- **Test pure logic.** Add tests for any new filter logic, calculations, or data transformations in `src/logic.test.js`.
- **Maintain accessibility.** Use semantic HTML, ARIA attributes, and ensure keyboard navigability.
- **Don't break the single-file model.** The app should always work by just opening `index.html`.

## API Key

The NREL API key in the source is a free-tier key for public data. See the [API Key section in README](README.md#api-key) for details.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
