# React Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone public HTML landing with a readable React route that preserves the singularity asset, restores the scroll narrative, and presents the project stack plus CI/CD as quiet supporting evidence.

**Architecture:** The Vite/React entry point gains a public `/` route while every existing `/admin` route remains unchanged. Landing content is split into focused React components with landing-scoped CSS; Nginx serves the React entry at root. Existing files in `public/landing/` remain in place and the singularity image continues to be referenced from that public URL.

**Tech Stack:** React 18, React Router 6, CSS, Vite, Nginx, Playwright, existing `@mui/icons-material`.

**Spec:** `docs/superpowers/specs/2026-09-10-react-landing-redesign-design.md`

## Global Constraints

- Do not add dependencies.
- Keep admin dashboard routes, OAuth, authorization, backend APIs, and admin visuals unchanged.
- Retain `frontend/public/landing/singularity-core-v3.png`; do not delete legacy landing files in this migration.
- Keep all public status language factual: no fabricated latency, availability, user counts, or live CI state.
- Use neutral graphite surfaces, structural borders, and accessible text; green is only a signal, focus, or active-state color.
- Do not put fog, blur, gradients, or glow behind readable text or product demonstrations.
- Honor `prefers-reduced-motion`, preserve visible keyboard focus, and avoid horizontal overflow at 390 px.
- Create RED test commits before their corresponding GREEN implementation commits. Do not create a PR or push during this plan.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/main.jsx` | Adds the public `/` route while retaining the exact existing `/admin` tree. |
| `frontend/src/pages/Landing.jsx` | Composes header, hero, story, and final project-contour sections. |
| `frontend/src/pages/Landing.css` | Contains only the public landing layout, responsive rules, focus styles, reduced-motion rules, and visual tokens local to this page. |
| `frontend/src/components/landing/LandingHero.jsx` | Renders the accessible hero copy, actions, and decorative singularity asset. |
| `frontend/src/components/landing/LandingStory.jsx` | Renders the sticky wide-screen narrative and three responsive product demonstrations. |
| `frontend/src/components/landing/TechnologyContour.jsx` | Renders labelled technology items and the low-emphasis CI/CD/repository links. |
| `frontend/nginx.conf` | Serves the Vite application entry at `/`, while preserving `/admin`, API, auth, and SSE proxy locations. |
| `frontend/tests/landing-routing.spec.js` | Tests the React public route, public navigation, technology contour, external links, and desktop/mobile visual contracts. |

## Task 1: Prove and add the public React route

**Files:**
- Modify: `frontend/tests/landing-routing.spec.js`
- Modify: `frontend/src/main.jsx`
- Create: `frontend/src/pages/Landing.jsx`
- Create: `frontend/src/pages/Landing.css`

**Interfaces:**
- Produces: `Landing`, a default-exported React component rendered at `/`.
- Preserves: `/admin/login` and all nested `/admin/*` route elements already declared in `main.jsx`.
- Consumes: the existing global style imports and React Router route tree.

- [ ] **Step 1: Write the failing route tests**

  Replace the standalone-artifact assertions with the following public-route contracts in `frontend/tests/landing-routing.spec.js`:

  ```js
  test('renders the public React landing at root while retaining the admin login', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)

    await expect(page).toHaveTitle(/Vibe/)
    await expect(page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Открыть админку' })).toHaveAttribute('href', '/admin')

    await page.goto(`${BASE_URL}/admin/login`)
    await expect(page.getByRole('heading', { name: 'Bot Dashboard' })).toBeVisible()
  })
  ```

  Add an anchor contract that finds `Интерфейс`, `Устройство`, and `Исходный код` by accessible name and asserts their `href` values are `#interface`, `#system`, and `#source` respectively.

- [ ] **Step 2: Run the route test to verify RED**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "public React landing"`

  Expected: FAIL because `/` has no React route with the specified heading.

- [ ] **Step 3: Commit the RED test checkpoint**

  ```bash
  git add frontend/tests/landing-routing.spec.js
  git commit -m "test: define public react landing route"
  ```

- [ ] **Step 4: Add the smallest route implementation**

  Create `Landing.jsx` with the route-level semantic structure and a default export:

  ```jsx
  import './Landing.css'

  export default function Landing() {
    return (
      <main id="top" className="landing">
        <h1>Тишина — тоже состояние системы.</h1>
        <a href="/admin">Открыть админку</a>
      </main>
    )
  }
  ```

  In `main.jsx`, import `Landing` and add `<Route path="/" element={<Landing />} />` before the admin routes. Do not restructure the protected admin route tree.

  Add a minimal `Landing.css` import-safe canvas/background rule only; visual composition belongs to later tasks.

- [ ] **Step 5: Run the focused test to verify GREEN**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "public React landing"`

  Expected: PASS.

- [ ] **Step 6: Commit the route implementation**

  ```bash
  git add frontend/src/main.jsx frontend/src/pages/Landing.jsx frontend/src/pages/Landing.css
  git commit -m "feat: render public landing through react"
  ```

## Task 2: Build the readable hero around the existing asset

**Files:**
- Modify: `frontend/tests/landing-routing.spec.js`
- Modify: `frontend/src/pages/Landing.jsx`
- Modify: `frontend/src/pages/Landing.css`
- Create: `frontend/src/components/landing/LandingHero.jsx`

**Interfaces:**
- Consumes: `Landing` as the page composition host and public asset URL `/landing/singularity-core-v3.png`.
- Produces: `LandingHero`, which renders the heading, product copy, in-page primary CTA, `/admin` CTA, and an `aria-hidden` decorative image.

- [ ] **Step 1: Write the failing hero and mobile-navigation tests**

  Add these assertions:

  ```js
  test('keeps the hero asset decorative and exposes mobile in-page navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/`)

    await expect(page.getByRole('link', { name: 'Интерфейс' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Устройство' })).toBeVisible()
    await expect(page.locator('img[src="/landing/singularity-core-v3.png"]')).toHaveAttribute('alt', '')
    await expect(page.locator('html')).toEvaluate((node) => node.scrollWidth <= node.clientWidth)
  })
  ```

- [ ] **Step 2: Run the hero test to verify RED**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "hero asset"`

  Expected: FAIL because the React landing does not yet render the navigation or asset.

- [ ] **Step 3: Commit the RED test checkpoint**

  ```bash
  git add frontend/tests/landing-routing.spec.js
  git commit -m "test: define readable landing hero"
  ```

- [ ] **Step 4: Implement `LandingHero` and compose it**

  Implement this component contract:

  ```jsx
  export default function LandingHero() {
    return (
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-shell landing-hero__grid">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">Vibe</p>
            <h1 id="landing-title">Тишина — тоже состояние системы.</h1>
            <p>Discord-бот, backend и интерфейс управления в одном авторском проекте.</p>
            <div className="landing-actions">
              <a className="landing-button landing-button--primary" href="#interface">Посмотреть систему</a>
              <a className="landing-button landing-button--quiet" href="/admin">Открыть админку</a>
            </div>
          </div>
          <img className="landing-hero__core" src="/landing/singularity-core-v3.png" alt="" />
        </div>
      </section>
    )
  }
  ```

  Add a semantic header in `Landing.jsx` with the three anchor links. On small screens keep them in a wrapping or horizontally scroll-free list; never hide the full set. Use an opaque `landing-hero__copy` layer and ensure all mist, `filter: blur`, radial backgrounds, and green washes are absent from both the copy and control areas. The asset itself may be darkened only with `filter: brightness()` and `contrast()`.

- [ ] **Step 5: Run focused visual contracts and build**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "hero asset" && npm run build`

  Expected: PASS and production build completes.

- [ ] **Step 6: Commit the hero implementation**

  ```bash
  git add frontend/src/components/landing/LandingHero.jsx frontend/src/pages/Landing.jsx frontend/src/pages/Landing.css
  git commit -m "feat: add readable signal-core hero"
  ```

## Task 3: Restore the scroll-led product narrative

**Files:**
- Modify: `frontend/tests/landing-routing.spec.js`
- Modify: `frontend/src/pages/Landing.jsx`
- Modify: `frontend/src/pages/Landing.css`
- Create: `frontend/src/components/landing/LandingStory.jsx`

**Interfaces:**
- Consumes: the `#interface` anchor from the header and page-level CSS tokens.
- Produces: `LandingStory`, with three named article sections: `Состояние сервера`, `Логика правила`, and `Проверяемый результат`.

- [ ] **Step 1: Write the failing narrative tests**

  Add a test that verifies all three article headings exist, the story copy is present, and the desktop sticky CSS contract exists:

  ```js
  test('presents the product proof as a three-step scroll narrative', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE_URL}/`)

    await expect(page.getByRole('heading', { name: 'Состояние сервера' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Логика правила' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Проверяемый результат' })).toBeVisible()
    await expect(page.locator('.landing-story__copy')).toHaveCount(1)
    await expect(page.locator('.landing-story__card')).toHaveCount(3)
  })
  ```

  Add a source assertion reading `src/pages/Landing.css` and requiring `position: sticky` inside the wide-screen story rule plus a mobile media rule that switches `.landing-story__copy` to `position: static`.

- [ ] **Step 2: Run the narrative test to verify RED**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "three-step scroll narrative"`

  Expected: FAIL because no story component or cards exist.

- [ ] **Step 3: Commit the RED test checkpoint**

  ```bash
  git add frontend/tests/landing-routing.spec.js
  git commit -m "test: define landing scroll narrative"
  ```

- [ ] **Step 4: Implement `LandingStory`**

  Render one explanatory column and three article cards with the exact heading sequence. Each demonstration uses neutral panels, semantic table/list markup where appropriate, and only representative, non-sensitive sample data. Use this data shape so the rendering stays declarative:

  ```jsx
  const STORY_STEPS = [
    { id: 'overview', title: 'Состояние сервера', label: '01 / overview' },
    { id: 'rule', title: 'Логика правила', label: '02 / rule' },
    { id: 'log', title: 'Проверяемый результат', label: '03 / log' },
  ]
  ```

  On desktop, grid the section as `minmax(260px, .58fr) minmax(0, 1fr)`, use `.landing-story__copy { position: sticky; top: 7rem; }`, and stack cards in the right column. Do not use any empty decorative left column. On mobile, use one column and `position: static`. Card spacing must follow the actual card edges; do not add blank viewport-height spacers between the last card and the next section.

- [ ] **Step 5: Run narrative tests and inspect both breakpoints**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "three-step scroll narrative" && npm run build`

  Then inspect `/` at 1440×900 and 390×844: story copy remains adjacent to the active card on desktop; all content flows in one column on mobile.

- [ ] **Step 6: Commit the narrative implementation**

  ```bash
  git add frontend/src/components/landing/LandingStory.jsx frontend/src/pages/Landing.jsx frontend/src/pages/Landing.css
  git commit -m "feat: restore landing scroll narrative"
  ```

## Task 4: Add the quiet technology and CI/CD contour

**Files:**
- Modify: `frontend/tests/landing-routing.spec.js`
- Modify: `frontend/src/pages/Landing.jsx`
- Modify: `frontend/src/pages/Landing.css`
- Create: `frontend/src/components/landing/TechnologyContour.jsx`

**Interfaces:**
- Consumes: `#source` header anchor and the existing MUI icon package.
- Produces: `TechnologyContour`, a labelled `ul` of seven technologies and two ordinary outbound links with `target="_blank"` and `rel="noreferrer"`.

- [ ] **Step 1: Write the failing technology-contour tests**

  Add the following contract:

  ```js
  test('shows the project technology contour without fabricated runtime metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)

    for (const name of ['React', 'FastAPI', 'PostgreSQL', 'discord.py', 'Docker', 'Nginx', 'GitHub Actions']) {
      await expect(page.getByRole('listitem', { name })).toBeVisible()
    }
    await expect(page.getByText('GitHub Actions → Docker → Nginx → production')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Открыть workflow' })).toHaveAttribute('target', '_blank')
    await expect(page.getByText(/99\.9%|42 ms|Production active/)).toHaveCount(0)
  })
  ```

- [ ] **Step 2: Run the technology test to verify RED**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "technology contour"`

  Expected: FAIL because no technology list or CI/CD line exists.

- [ ] **Step 3: Commit the RED test checkpoint**

  ```bash
  git add frontend/tests/landing-routing.spec.js
  git commit -m "test: define landing technology contour"
  ```

- [ ] **Step 4: Implement `TechnologyContour`**

  Define and render this complete technology model:

  ```jsx
  const TECHNOLOGIES = [
    ['React', CodeRounded],
    ['FastAPI', DataObjectRounded],
    ['PostgreSQL', StorageRounded],
    ['discord.py', SmartToyOutlined],
    ['Docker', Inventory2Outlined],
    ['Nginx', DnsOutlined],
    ['GitHub Actions', AccountTreeOutlined],
  ]
  ```

  Each `li` uses `aria-label={name}`, an `aria-hidden` icon, and a visible label. Render the pipeline sentence exactly as tested. Add low-emphasis outbound repository and Actions links; set the actual repository URL to `https://github.com/fantom2513/vibe_ds_bot` and the Actions link to `https://github.com/fantom2513/vibe_ds_bot/actions`. Give both `target="_blank" rel="noreferrer"` and clear visible labels.

  Place this component in the final `#source` section. Make the list visually denser than the hero but not a wall of identical cards: a responsive grid with structural dividers, no metric panel, no animated pulse, and no green background wash.

- [ ] **Step 5: Run technology tests and build**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "technology contour" && npm run build`

  Expected: PASS and production build completes.

- [ ] **Step 6: Commit the technology contour**

  ```bash
  git add frontend/src/components/landing/TechnologyContour.jsx frontend/src/pages/Landing.jsx frontend/src/pages/Landing.css
  git commit -m "feat: add project technology contour"
  ```

## Task 5: Deliver root routing and visual verification

**Files:**
- Modify: `frontend/nginx.conf`
- Modify: `frontend/tests/landing-routing.spec.js`
- Modify: `frontend/src/pages/Landing.css`

**Interfaces:**
- Consumes: the public `/` React route and existing frontend build output.
- Preserves: `/admin`, `/admin/`, `/api/`, `/auth/`, and `/api/dashboard/stream` Nginx behavior.

- [ ] **Step 1: Write the failing Nginx and motion tests**

  Add source-level assertions that Nginx root routes `/` to `/index.html`, retains `location = /admin`, and no longer targets `/landing/index.html`. Add a browser assertion for reduced motion:

  ```js
  test('keeps the landing readable when motion is reduced', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${BASE_URL}/`)

    await expect(page.getByRole('heading', { name: 'Тишина — тоже состояние системы.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Посмотреть систему' })).toBeVisible()
  })
  ```

- [ ] **Step 2: Run the Nginx/motion tests to verify RED**

  Run: `cd frontend && npx playwright test tests/landing-routing.spec.js --grep "reduced"`

  Expected: FAIL until the explicit landing reduced-motion styling exists. The Nginx source assertion must also fail while root serves the static artifact.

- [ ] **Step 3: Commit the RED test checkpoint**

  ```bash
  git add frontend/tests/landing-routing.spec.js
  git commit -m "test: define react landing delivery"
  ```

- [ ] **Step 4: Update delivery and polish styles**

  Replace only the root `location = /` body in `nginx.conf` with `try_files /index.html =404;`. Preserve every other location block exactly.

  Add a `@media (prefers-reduced-motion: reduce)` block in `Landing.css` that disables landing-specific `animation` and `transition`, and changes `scroll-behavior` to `auto`. Ensure heading-anchor targets use `scroll-margin-top` that clears the header. Do not add moving background decoration.

- [ ] **Step 5: Run the full landing suite, lint, and production build**

  Run:

  ```bash
  cd frontend
  npx playwright test tests/landing-routing.spec.js
  npm run lint
  npm run build
  ```

  Expected: all landing tests pass; lint has at most the pre-existing project warning allowance; build succeeds.

- [ ] **Step 6: Perform visual QA before committing**

  Inspect the built landing locally at 1440×900 and 390×844. Accept only if:

  - hero text remains fully readable without a green overlay;
  - the singularity asset is clearly visible but does not compete with copy;
  - the desktop story never leaves an unexplained blank left column;
  - the final technology contour is visibly secondary to the product story;
  - header links, CTAs, and outbound links show keyboard focus;
  - no horizontal scrollbar appears at 390 px.

- [ ] **Step 7: Commit the delivery and verification changes**

  ```bash
  git add frontend/nginx.conf frontend/src/pages/Landing.css frontend/tests/landing-routing.spec.js
  git commit -m "fix: serve react landing at root"
  ```

## Execution-order verification

- Task 1 creates the route contract before adding the public route.
- Task 2 tests and introduces the visual asset/hero independently of the story.
- Task 3 tests the scroll narrative before adding sticky composition.
- Task 4 tests the static technology proof before its implementation.
- Task 5 changes root delivery only after the React route and visual contracts exist.
- No task deletes the legacy asset or static landing files.
