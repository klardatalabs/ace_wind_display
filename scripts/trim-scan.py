"""Trims the Lawrence Weston scan for the community screen.

The full scan reaches about 2 km from the turbine, but past ~800 m its splats are ~20 m
wide and read as blur. This keeps the sharp middle, fades the outer ring out so the
scan melts into the generated landscape around it, and drops everything beyond.

    python scripts/trim-scan.py [source] [output]

Defaults: assets/source/lawrence-weston-site.splat -> frontend/public/scenes/lawrence-weston-site.splat
The .splat layout is 32 bytes a splat: position (3 x f32), scale (3 x f32), RGBA (4 x u8),
rotation (4 x u8). Radii are measured in world metres, so the transform must match
frontend/src/three/splat.js.
"""

import sys
import numpy as np

SOURCE = sys.argv[1] if len(sys.argv) > 1 else "assets/source/lawrence-weston-site.splat"
OUTPUT = sys.argv[2] if len(sys.argv) > 2 else "frontend/public/scenes/lawrence-weston-site.splat"

SCALE = 1.2432
POSITION = np.array([-39.038, -0.497, -618.265])
FADE_START, FADE_END = 650.0, 900.0  # metres from the turbine

raw = np.fromfile(SOURCE, dtype=np.uint8)
n = len(raw) // 32
splats = raw[: n * 32].reshape(n, 32).copy()
pos = splats[:, 0:12].copy().view(np.float32).reshape(n, 3)

# Same placement as the scene: 180 degrees about x, scaled, moved so the turbine is the origin.
world = np.stack([pos[:, 0], -pos[:, 1], -pos[:, 2]], 1) * SCALE + POSITION
radius = np.hypot(world[:, 0], world[:, 2])

keep = radius < FADE_END
fade = np.clip((FADE_END - radius) / (FADE_END - FADE_START), 0, 1)
alpha = splats[:, 27].astype(np.float32) * fade
splats[:, 27] = np.round(alpha).astype(np.uint8)
keep &= splats[:, 27] > 0

splats[keep].tofile(OUTPUT)
print(f"{keep.sum():,} of {n:,} splats kept ({keep.sum() * 32 / 1e6:.1f} MB) -> {OUTPUT}")
