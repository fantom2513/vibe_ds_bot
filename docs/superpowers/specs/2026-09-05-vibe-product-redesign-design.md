# Vibe Product Redesign

**Date:** 2026-09-05  
**Status:** Proposed for implementation planning  
**Scope:** Design system, administrative dashboard, public landing page, member portal, and access states for the existing single-server Discord bot.

## 1. Purpose

Vibe should feel like a focused community control product rather than a generic AI-generated admin template. The redesign must make dense operational data easy to scan while giving ordinary Discord members a useful personal experience.

The product has three access zones:

1. A public landing page for signed-out visitors.
2. A personal portal for authenticated members of the configured Discord server.
3. An administrative control panel for explicitly authorized administrators.

The current bot serves one Discord server. Multi-server onboarding, billing, pricing, installation flows, and server switching are out of scope.

## 2. Design principles

- **Operational clarity:** every visible block answers a concrete question.
- **Balanced density:** compact tables and controls, with enough spacing to preserve hierarchy.
- **No card soup:** use containers only when they establish grouping or interaction boundaries.
- **No decorative AI styling:** no gratuitous glow, gradients, glass effects, floating orbs, oversized empty regions, or ornamental charts.
- **Color communicates:** brand color indicates action and activity; semantic colors indicate state.
- **Progressive access:** guests learn, members see their own progress, administrators control the system.
- **Privacy by default:** personal and administrative data is never exposed on the public page.

## 3. Visual direction

### 3.1 Product character

The approved direction is **Balanced Premium** with compact operational tables where needed.

- Backgrounds are neutral graphite rather than blue-black or purple-tinted.
- Soft Mint is the primary product color.
- Typography is expressive at the page-title level and quiet everywhere else.
- Surfaces are flat and separated by tonal contrast and structural borders.
- Shadows and glow are not part of the default visual language.

### 3.2 Color system

#### Neutral graphite scale

| Token | Value | Intended use |
|---|---:|---|
| `neutral.950` | `#080A0D` | Page canvas |
| `neutral.900` | `#0C1015` | App shell |
| `neutral.850` | `#0F141A` | Inputs and recessed areas |
| `neutral.800` | `#12171E` | Primary surfaces |
| `neutral.750` | `#171D24` | Hovered neutral surfaces |
| `neutral.700` | `#202832` | Structural dividers |
| `neutral.650` | `#293440` | Strong borders and secondary fills |

The final implementation must include accessible primary, secondary, and disabled text tokens rather than raw neutral values in components.

#### Brand palette

| Token | Value | Meaning |
|---|---:|---|
| `brand.mint` | `#65C69C` | Primary actions, active navigation, enabled rules, positive movement |
| `signal.sky` | `#67B9DE` | Bot connection, live data, informational states, links |
| `attention.amber` | `#DDB868` | Warning, pending, thresholds, needs attention |

#### Service-only semantic color

| Token | Value | Meaning |
|---|---:|---|
| `danger.rose` | `#E58A94` | Errors, destructive actions, irreversible outcomes |

Danger Rose is not a brand color. It appears only where danger or failure is present.

Color must not be the sole state indicator. Statuses also require text, an icon, shape, or position.

### 3.3 Typography

- **Unbounded 600:** brand wordmark, landing hero, and major page titles only.
- **IBM Plex Sans 400/500/600/700:** body text, navigation, forms, tables, buttons, and component labels.
- **IBM Plex Mono 400/500:** IDs, timestamps, XP, durations, rule codes, and aligned numeric data.

Unbounded must not be used for body copy, table headings, controls, or long text. The current Syne usage is removed.

### 3.4 Shape, border, and elevation

- Small controls: 6–7 px radius.
- Cards and panels: 8–10 px radius.
- Large shell containers: 14–16 px radius.
- Structural borders use neutral tokens; colored borders are reserved for focus, selection, warning, and error.
- Default surfaces are flat. Modal and drawer separation may use a restrained dark elevation treatment.

### 3.5 Iconography

- Use one outlined Material icon family.
- Typical sizes are 18 px in controls and 20 px in navigation.
- Do not use emoji as logos, empty-state illustrations, status indicators, or action icons.
- Icon-only actions require accessible names and tooltips where the meaning is not obvious.

## 4. Component system

The implementation follows four layers:

1. Primitive tokens: color, type, spacing, radius, border, motion.
2. Semantic tokens: surface, text, interactive, live, success, warning, danger.
3. Component recipes: variants and interaction states.
4. Page compositions: landing, member portal, and admin panel.

Raw colors and one-off visual values must not remain in page components.

### 4.1 Buttons

Variants:

- Primary: Soft Mint fill; one primary action per local context.
- Secondary: neutral surface and structural border.
- Ghost: low-emphasis action with no persistent container.
- Destructive: Danger Rose text/border; filled danger is reserved for final confirmation.

States:

- Default.
- Hover: for primary, a modestly lighter mint, a subtle light border, and 1 px upward translation.
- Pressed: darker mint and return/downward translation.
- Keyboard focus: visible outer ring, independent of hover.
- Disabled: neutral low-contrast treatment with no hover response.
- Loading: label remains visible and an inline progress indicator is added.

Hover rules must be scoped by component variant so primary styling cannot leak into secondary or destructive buttons.

### 4.2 Toggle

- Off uses neutral track and thumb.
- On uses Soft Mint and an explicit accompanying label.
- Hover changes track/border contrast.
- Keyboard focus uses the mint focus ring.
- Disabled lowers contrast but preserves the on/off position.
- Saving state prevents repeated mutation and communicates progress.

An enabled toggle means the setting is active; it does not mean the preceding request succeeded.

### 4.3 Inputs

Required states are empty, hover, focus, filled, error, disabled, and read-only where applicable.

- Labels remain visible; placeholders do not replace labels.
- Focus uses a mint border and focus ring.
- Error uses Danger Rose plus an adjacent explanatory message and icon.
- Validation is shown beside the relevant field.

### 4.4 Navigation and table rows

- Navigation hover uses a neutral surface.
- Active navigation uses a subdued mint background plus mint text/icon.
- Clickable rows have hover and keyboard-focus states.
- Selected rows use a restrained mint surface and structural border.
- Non-clickable rows do not pretend to be interactive.

### 4.5 Feedback components

- Loading: skeletons matching the final content geometry.
- Empty: one outlined icon, a short explanation, and at most one relevant action.
- Error: local message with retry when recovery is possible.
- Toast: confirmation of completed background actions; it must not be the only error location.

## 5. Navigation shell

The approved navigation is a **collapsible labeled sidebar**.

- Wide screens: approximately 184–200 px, with labels and groups.
- Medium screens: collapses into an icon rail.
- Small screens: becomes a modal drawer.
- The collapse state may be remembered locally.

Administrative navigation is grouped into Monitoring and Management rather than presented as one undifferentiated list.

The member portal uses a smaller navigation set: My Progress, Session History, Leaderboard, and How XP Works. Administrative navigation is not rendered for ordinary members.

## 6. Access model

### 6.1 Roles

| Role | Eligibility | Experience |
|---|---|---|
| Guest | No valid session | Public landing page |
| Member | Authenticated Discord user who belongs to the configured guild | Personal portal |
| Admin | Authenticated member explicitly authorized for administration | Personal portal plus admin panel |
| Authenticated outsider | Valid Discord identity but not a guild member | Restricted access screen with account switching/logout |

For the first implementation, the existing `ALLOWED_DISCORD_IDS` remains the authoritative administrator list. It should be represented to the frontend as an explicit access role, not inferred client-side.

Guild membership must be verified server-side. Failure to verify membership must not grant member data.

### 6.2 Authorization requirements

- Frontend route guards are presentation only.
- Every personal API verifies the current Discord identity and restricts queries to that identity.
- Every administrative API verifies the admin role on the server.
- An authenticated member cannot select another Discord ID to retrieve personal data.
- Public endpoints return no member, rule, session, or server-operational data.

The current OAuth callback returns a raw 403 for users outside the administrator allowlist. The redesign changes this model: successful Discord authentication can create a member session, while authorization determines which zones are available.

### 6.3 Session payload

The authenticated-user response must provide enough information for routing without exposing authorization internals:

- Discord ID.
- Username and avatar.
- Membership state.
- Access role: member or admin.
- Configured guild display information where safe.

## 7. Public landing page

The landing page is a community entrance for one server, not a commercial SaaS page.

### 7.1 Content order

1. Header: Vibe Community brand, section links, Discord login.
2. Hero: “Тишина тоже считается”, concise product explanation, login CTA, XP explanation link.
3. Product preview: a representative personal level card without real member data.
4. Feature row: voice automation, Mute XP and levels, schedules, personal statistics.
5. “How it works”: Discord login, full mute, XP/levels/roles.
6. Footer: privacy, Discord OAuth explanation, and service status/support if available.

### 7.2 Exclusions

- No pricing.
- No customer logos or fabricated testimonials.
- No “Add to Discord” flow.
- No live member counts, operational rules, logs, or real personal data.
- No generic marketing sections added only to make the page longer.

## 8. Member portal

The member portal turns successful authentication into a useful personal experience.

### 8.1 Progress overview

- Discord avatar and username.
- Current level number and configured label.
- Current XP.
- XP required for the next configured level.
- Progress bar and remaining XP.
- Next role reward when configured.
- Rank in the member leaderboard.

When there is no next level, the interface shows a completed/max-level state rather than an empty progress bar.

### 8.2 Personal statistics

- Total time in full mute.
- Completed mute-session count.
- Recent progress over a useful period when supported by data.
- Current leaderboard position.

### 8.3 Session history

The member sees only their own mute sessions:

- Date/time.
- Voice channel where appropriate for the community privacy policy.
- Duration.
- XP earned.

The initial view shows recent sessions; full history can be paginated.

### 8.4 Leaderboard

The authenticated leaderboard may expose only:

- Display name and avatar.
- Level.
- XP or another explicitly approved ranking value.

It must not expose Discord IDs, private session history, moderation actions, or administrative notes. The current member is visibly highlighted.

## 9. Administrative dashboard

The admin Dashboard is a compact command center, not a reporting page.

### 9.1 Information hierarchy

1. Page header: guild context, bot connection, primary action.
2. Four metrics: in voice now, active rules, actions today, needs attention.
3. Main workspace:
   - Voice-presence table as the dominant panel.
   - Live activity stream as the secondary panel.
4. Active-rules table with scope, trigger count, and last trigger.

### 9.2 Empty-space policy

- Panels size to their real content constraints.
- Empty dashboard areas are not filled with decorative charts.
- When a dataset is empty, replace the data region with a compact actionable empty state.
- Charts appear only when a trend supports an actual operational decision.

## 10. Responsive behavior

### Wide

- Labeled sidebar.
- Four metrics in one row.
- Voice table and activity stream side by side.
- Full active-rules columns.

### Medium

- Icon rail or user-controlled collapsed sidebar.
- Metrics may form a 2×2 grid.
- Voice table remains primary; activity moves below when necessary.
- Secondary table columns may be hidden while essential values remain available.

### Small

- Navigation drawer.
- Single-column content.
- Primary actions remain reachable without horizontal scrolling.
- Dense tables become responsive rows or expose controlled horizontal scrolling when column relationships must be preserved.
- Touch targets are at least 44×44 px even when visual glyphs are smaller.

## 11. Motion

- Fast hover/press transitions: approximately 120–160 ms.
- Drawers and page-level transitions: approximately 180–220 ms.
- Motion communicates state or spatial relationship.
- No bouncing, looping decoration, glow animation, or staggered entrance choreography for routine data.
- Respect `prefers-reduced-motion`.

## 12. Error and edge cases

- Discord OAuth cancellation returns to the landing page with a clear, recoverable message.
- Authenticated non-members receive a dedicated restricted-access screen, not a raw API error.
- Expired sessions return the user to login while preserving a safe return path.
- Bot offline is shown with Signal/Warning semantics; cached personal data must be labeled if displayed.
- Missing XP data produces a valid level-zero state.
- Missing level configuration explains that progression is not configured; it does not fabricate a next level.
- Deleted or unavailable Discord roles are shown as unavailable rewards.
- Partial API failures remain local to the affected dashboard panel when possible.

## 13. Accessibility

- Text contrast targets WCAG AA.
- Focus indicators remain visible on every interactive element.
- Every icon-only control has an accessible name.
- Status never relies on color alone.
- Tables retain semantic headers and logical reading order.
- Form errors are programmatically associated with their fields.
- Loading and live updates do not repeatedly interrupt assistive technology.

## 14. Verification strategy

The implementation plan must include:

- Unit tests for access-role derivation and personal-data scoping.
- API tests proving members cannot access another member’s data or admin endpoints.
- Route tests for guest, member, admin, outsider, and expired-session states.
- Component tests for primary/secondary/destructive variants and their disabled/loading states.
- Keyboard tests for navigation, dialogs, drawers, forms, and interactive rows.
- Responsive checks at small, medium, and wide breakpoints.
- Visual checks for the approved Dashboard, landing page, member portal, and component state board.
- Contrast checks for text and semantic state combinations.

## 15. Acceptance criteria

- No emoji remains in product navigation, empty states, login branding, or status UI.
- No page uses the previous purple/Discord-blurple palette.
- Soft Mint, Signal Sky, Attention Amber, and Danger Rose follow the roles defined here.
- Unbounded is restricted to brand and major headings.
- Guest, member, admin, and authenticated-outsider experiences are distinct and server-authorized.
- Members can view their own level, XP progress, total mute time, rank, and recent sessions.
- Members cannot access administrative data or another member’s private history.
- Admin Dashboard presents general state, voice presence, current events, and active rules without decorative filler.
- Components expose consistent hover, pressed, focus, disabled, loading, and error states where applicable.
- The interface remains usable by keyboard and at supported responsive breakpoints.

## 16. Explicit non-goals

- Multi-guild support.
- Bot installation or server onboarding.
- Billing, subscriptions, or pricing.
- Public member statistics.
- Social feeds, messaging, achievements beyond the existing configured level/role system.
- Replacing Material UI as the underlying component library.

