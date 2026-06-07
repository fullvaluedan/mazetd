// =============================================================================
// pathfinding.js — how enemies (and the hero) find their way through the maze.
//
// There are two tools here, used for different jobs:
//
//  1. bfsDistanceField(...) — a breadth-first "distance to goal" map over the
//     whole grid. Because the grid is 4-connected with uniform step cost, BFS
//     gives the exact shortest-path distance from every cell to the goal. Enemies
//     then just walk "downhill" (always step to the neighbour with the smallest
//     distance). This is the secret to cheap dynamic re-routing: rebuild the
//     field once after any build/sell and EVERY enemy instantly has a correct new
//     route from wherever it currently stands. It also backs the "can I build
//     here?" check (a cell is reachable iff its distance is finite).
//
//  2. aStar(...) — a classic A* shortest path returning an explicit cell list.
//     Used for the hero's move-to command (arbitrary start/target) — the field
//     approach is per-goal, A* is per-(start,goal).
//
// `walkable(x, y)` is a caller-supplied predicate: true if enemies may occupy
// that cell (not a wall, obstacle, or tower).
// =============================================================================

import { COLS, ROWS, NEIGHBORS4, inBounds } from './grid.js';

export const UNREACHABLE = Infinity;

// Build a COLS*ROWS Float64Array of distances (in steps) from (goalX,goalY).
// Cells you can't reach stay at UNREACHABLE.
export function bfsDistanceField(walkable, goalX, goalY) {
  const dist = new Float64Array(COLS * ROWS).fill(UNREACHABLE);
  if (!inBounds(goalX, goalY)) return dist;
  const idx = (x, y) => y * COLS + x;
  dist[idx(goalX, goalY)] = 0;
  // Simple ring-buffer queue of packed indices.
  const queue = new Int32Array(COLS * ROWS);
  let head = 0, tail = 0;
  queue[tail++] = idx(goalX, goalY);
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % COLS, cy = (cur / COLS) | 0;
    const nd = dist[cur] + 1;
    for (let i = 0; i < 4; i++) {
      const nx = cx + NEIGHBORS4[i][0];
      const ny = cy + NEIGHBORS4[i][1];
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (dist[ni] !== UNREACHABLE) continue;     // already visited
      if (!walkable(nx, ny)) continue;            // wall/obstacle/tower
      dist[ni] = nd;
      queue[tail++] = ni;
    }
  }
  return dist;
}

export function fieldAt(dist, x, y) {
  if (!inBounds(x, y)) return UNREACHABLE;
  return dist[y * COLS + x];
}

export function isReachable(dist, x, y) {
  return fieldAt(dist, x, y) !== UNREACHABLE;
}

// Trace the shortest route from (startX,startY) downhill to the goal of a field.
// Returns a list of {x,y} cells (start ... goal), or null if unreachable.
// This is exactly the route enemies follow, so it doubles as the path overlay.
export function tracePath(dist, startX, startY) {
  if (!isReachable(dist, startX, startY)) return null;
  const path = [{ x: startX, y: startY }];
  let cx = startX, cy = startY;
  let guard = COLS * ROWS + 5;   // can't be longer than the whole grid
  while (fieldAt(dist, cx, cy) > 0 && guard-- > 0) {
    let best = null, bestD = fieldAt(dist, cx, cy);
    for (let i = 0; i < 4; i++) {
      const nx = cx + NEIGHBORS4[i][0];
      const ny = cy + NEIGHBORS4[i][1];
      const d = fieldAt(dist, nx, ny);
      if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
    }
    if (!best) break;       // stuck (shouldn't happen on a valid field)
    path.push(best);
    cx = best.x; cy = best.y;
  }
  return path;
}

// A* from start to goal over walkable cells. Returns [{x,y}...] or null.
export function aStar(walkable, startX, startY, goalX, goalY) {
  if (!inBounds(startX, startY) || !inBounds(goalX, goalY)) return null;
  const idx = (x, y) => y * COLS + x;
  const N = COLS * ROWS;
  const gScore = new Float64Array(N).fill(Infinity);
  const fScore = new Float64Array(N).fill(Infinity);
  const cameFrom = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const h = (x, y) => Math.abs(x - goalX) + Math.abs(y - goalY); // Manhattan

  const s = idx(startX, startY);
  gScore[s] = 0; fScore[s] = h(startX, startY);
  // Tiny binary-less open set: we scan for the min-f node. Grid is small (<=504
  // cells) so a linear scan is plenty fast and keeps the code readable.
  const open = new Set([s]);

  while (open.size) {
    let cur = -1, curF = Infinity;
    for (const n of open) { if (fScore[n] < curF) { curF = fScore[n]; cur = n; } }
    const cx = cur % COLS, cy = (cur / COLS) | 0;
    if (cx === goalX && cy === goalY) {
      // Reconstruct.
      const path = [];
      let n = cur;
      while (n !== -1) { path.push({ x: n % COLS, y: (n / COLS) | 0 }); n = cameFrom[n]; }
      path.reverse();
      return path;
    }
    open.delete(cur);
    closed[cur] = 1;
    for (let i = 0; i < 4; i++) {
      const nx = cx + NEIGHBORS4[i][0];
      const ny = cy + NEIGHBORS4[i][1];
      if (!inBounds(nx, ny) || !walkable(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const tentative = gScore[cur] + 1;
      if (tentative < gScore[ni]) {
        cameFrom[ni] = cur;
        gScore[ni] = tentative;
        fScore[ni] = tentative + h(nx, ny);
        open.add(ni);
      }
    }
  }
  return null;   // no path
}
