/// <reference path="../.astro/types.d.ts" />

/** Commit, rama y fecha de la publicación; lo inyecta astro.config.mjs. Lo usa el modo revisión. */
declare const __VERSION_SITIO__: { commit: string; rama: string; publicada: string };
