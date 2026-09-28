# Vietnamese and follow-up review

Baseline: 39a1ccc. A fetch found no newer commits on origin/main on 2026-09-28.

## Logic fixes

- Imported stage identity now includes note content, not only file name and size,
  preventing different same-name/same-size arrangements from sharing an entry.
  Existing imported-song records keep their old keys; campaign progress is unchanged.
- Saving without a storage provider now reports failure rather than claiming success.

## Language

English and Vietnamese are available on the title screen and in Settings. The
selection is stored separately from progress; unavailable storage still permits
session-only switching. First visit follows the browser language (Vietnamese or
English fallback). Switching does not reload the page or interrupt the current run.

The translation adapter observes added UI text and accessible labels, preserves
English originals for switching back, and never modifies control values or IDs.
Story text is translated before typewriter animation. All story lines have a
Vietnamese translation. The core menus, settings, mode instructions, result labels,
and gameplay feedback are translated. Unknown messages fall back to English;
technical errors and source/license credits may retain English text.

Song metadata and Words-mode English typing exercises remain unchanged, as do
musical note names and physical key labels. The separate classic studio remains
English. New interface copy should be added to vi.ts with a regression check.

## Verification

Unit tests cover language fallback/storage failures, dynamic translation, switching
back to English, protected game text, story coverage, import identity, and saves.
Browser checks cover title selection without starting gameplay, persistence after
reload, Vietnamese phone settings at 390 × 844 without page overflow, and English
restoration without changing lane values. Phone settings screenshot inspected.
