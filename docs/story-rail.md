# Story rail preview

`/screen/story` currently contains chapters 1–6 and loops after 64 seconds. Chapters 7–9 and the home diorama are intentionally absent at this review gate.

The existing chapter timer, camera rig, canvas, chrome, labels, and hotspot cards have an opt-in rail mode. Other screens retain their named shots and visitor pause behavior. Pill selection seeks to rail time; dragging offsets the moving camera and eases back after three seconds of inactivity.

The energy line uses the existing tower cable and pylon wire samples. Its glow is an educational overlay, including the underground connector, rather than a surveyed grid route. Generator magnets are illustrative; their count is not a turbine specification. The converter stays at the tower base.

Checks:

```sh
npm run build
tsc --noEmit
node frontend/src/three/storyTimeline.test.mjs
```

The TypeScript configuration checks the new rail and timeline modules; it does not migrate the existing JavaScript app. A host without `tsc` can use `npm exec --package=typescript -- tsc --noEmit` without changing the dependency manifests.

For repeatable chapter frames, use `/screen/story?debug&storyTime=35`. `storyTime` freezes camera time while live telemetry and generator animation continue. The hidden `data-story-state` output includes camera positions in scene metres. Normal playback is `/screen/story`.

Production-display 60 fps has not been certified. Automated browser measurements were below that target; final hardware performance work remains necessary.
