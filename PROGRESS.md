# Progress

One line per phase as it's completed.

- **Phase 0 — Scaffold:** ✅ Project structure, index.html (canvas + HUD shell), fixed-timestep loop (pause + 1×/2×/3×), full `config.js` data tables, seeded RNG, start scripts, docs. Dark canvas renders, loop logs ~60Hz.
- **Phase 1 — Map & pathfinding:** ✅ Grid + cell types, seeded obstacle scatter (6–10 clusters) with reachability guarantee (regenerates if a spawn is trapped), 3 spawns / 2 goals with markers + labels, BFS distance fields + A* + path tracing, animated dotted path overlay (toggle `P`), and the Wintermaul build-legality check. Verified across 40 seeds: all stay connected; greedy interior fill (322 towers) never fully blocks a route.
- **Phase 2 — Enemies move & leak:** ✅ Enemy entities follow the distance-field gradient (ground) or fly straight (flying), with status-effect + damage scaffolding (armor/magic/poison/shield/shatter). Leaks cost lives, kills award gold; wave runtime (staggered spawn queue + scaling formulas) + minimal HUD (gold/lives/wave, pause/speed, Start Wave). Enemy/floater/flash rendering. Verified headless: Grunts traverse & leak (lives 20→10), ground enemy completes a 32-cell route, flyer leaks straight, no-defense run loses at wave 2.
