# ADR 0002: Client state stays in React state (no Zustand)

## Status

Accepted (2026-11-25). A deviation from the platform constitution, which names Zustand for client state.

## Context

The constitution makes TanStack Query mandatory for server state (ADR 0001 follows it here) and Zustand for client state. This remote has very little client state, and none of it is shared between screens:

- a form's draft values, the open dialog, a tab, a filter being edited, a row's local selection: each belongs to one component and dies with it;
- the "saved" notices, which live in the page that owns the screen (a card keyed by a record's version remounts on a save, so a notice kept in the card is lost);
- the audit filter, which lives in the URL, so a link or a reload keeps it;
- the export job list, which is a list of IDs, kept in the SDK's per-app storage behind a port (`ExportJobStore`), so it survives a reload and is cleared on sign-out;
- everything that comes from the shell (the user, permissions, the session context, read-only, step-up) is read through SDK hooks and is not copied into a store.

## Decision

Keep client state in React state (`useState`, `useReducer`), the URL and the SDK's storage. Do not add Zustand.

## Consequences

- No extra dependency or store boilerplate, and no second place a value can live.
- If a screen ever needs state shared across screens or across remounts that none of the above covers, add Zustand then and supersede this ADR.
- The rule "a notice that must outlive a form's remount lives in the page" (see the LLD, §7.9) replaces what a store would otherwise be used for here.
