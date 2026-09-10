# React Landing Redesign

**Date:** 2026-09-10  
**Status:** Approved for specification review  
**Scope:** Public Vibe landing page and its delivery route. The authenticated admin panel, API, and Discord OAuth flow are explicitly out of scope.

## Purpose

Replace the independently served static landing document with a React route at `/`. The page should preserve Vibe's existing singularity-core asset and scroll-led narrative while restoring the information hierarchy obscured by green atmospheric effects and large empty regions.

The landing is a portfolio-quality presentation of a real Discord-management project, not a commercial SaaS pitch. It must demonstrate a coherent, working product without exposing server data or exaggerating live operational claims.

## Architecture and delivery

- Add a public `Landing` React page rendered by the existing React application at `/`.
- Keep all authenticated admin routes under `/admin` and preserve their current authorization behavior.
- Change the frontend Nginx root location to return the Vite application entry point, so `/` resolves through React rather than `public/landing/index.html`.
- Retain the existing singularity-core asset in the public asset directory; do not recreate or replace it.
- Keep legacy static landing assets untouched during this change. They may be removed only in a separately authorized cleanup after the React landing is verified in production.

## Composition

### Hero: signal core

The hero remains Vibe's one expressive moment. The singularity-core asset is positioned to the right of a stable text column, with a fully opaque, neutral canvas behind the heading, copy, and CTA. The image may have local material contrast but no haze, blur, or colored wash may cross into the copy column.

The hero introduces the project with one concise statement and routes visitors to the interface story or the admin login. The decorative asset is hidden from assistive technology and never substitutes for text.

### Scroll narrative: the product proof

The existing scroll logic is preserved as a deliberate sequence. A sticky explanatory column stays visible on wide screens while three interface demonstrations advance in the adjacent column:

1. Current system overview.
2. Rule logic from trigger to outcome.
3. Auditable action log.

The sticky copy and active demonstration share the same vertical frame. This removes the current empty left half and prevents the narrative from losing its context. On narrow screens, the sequence becomes a single-column stack with no sticky positioning and no horizontal overflow.

No card, panel, or section may use green atmospheric fog, glow, or gradients behind information. Mint is reserved for active states, focus, signal lines, and positive status text. Surfaces remain neutral graphite with structural borders and accessible text contrast.

### Closing proof: project contour

The final section presents the project as a real, inspectable system:

- a restrained prompt to open the admin interface or repository;
- a static technology row with labelled icons for React, FastAPI, PostgreSQL, discord.py, Docker, Nginx, and GitHub Actions;
- a low-emphasis CI/CD line: `GitHub Actions → Docker → Nginx → production`;
- a direct link to the public repository or its Actions workflow.

CI/CD is supporting evidence, not a hero claim. The page must not display fabricated availability, latency, user counts, or live deployment status. Data that is not fetched from an authoritative source is described as architecture, not as current runtime state.

## Components

- `Landing`: route composition and anchor targets.
- `LandingHero`: copy, calls to action, decorative singularity-core image.
- `LandingStory`: responsive sticky narrative and its three product demonstrations.
- `LandingSystem`: compact architecture explainer if retained from the current story.
- `TechnologyContour`: labelled technology icons and the secondary CI/CD link.

Components use the existing global tokens and typography where compatible. New landing-only styles live alongside the React source rather than inside a monolithic HTML `<style>` block. No new package is required; technology icons use the already-installed Material icon set or accessible labelled SVG marks already available in the application.

## Interaction, motion, and accessibility

- Anchor navigation has a visible focus state and accounts for the header offset.
- Buttons and links have hover, active, and `:focus-visible` feedback.
- The design respects `prefers-reduced-motion`: no auto-playing decorative motion and no animation required to reveal content.
- The technology row remains understandable through visible labels; icons are decorative when accompanied by text.
- Text and controls meet WCAG AA contrast against their immediate backgrounds.
- Mobile navigation exposes the essential in-page links or a clear menu rather than silently removing them.

## Error handling

The public landing does not depend on dynamic CI or runtime-status fetches. A failed external repository/Actions link therefore leaves the page itself fully functional; the link is an ordinary outbound navigation with a clear label.

## Verification

- Extend route tests to confirm `/` renders the React landing and `/admin` retains its current login route.
- Assert the public singularity asset, primary anchors, admin CTA, and labelled technology items render.
- Verify the CI/CD link targets the intended public GitHub destination.
- Build the frontend and run the affected Playwright suite.
- Inspect the landing at wide desktop and 390 px mobile widths for readable copy, no horizontal overflow, no missing navigation, and no empty desktop column.
- Check the reduced-motion mode and keyboard focus of header, CTA, and footer links.

## Non-goals

- Dynamic GitHub API integration, tokens, backend proxying, or live pipeline state.
- Changes to admin dashboard visuals, authorization, backend endpoints, or OAuth.
- Removing legacy landing files during this migration.
- New dependencies or a design-system rewrite.
