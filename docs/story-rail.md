# Story rail preview

`/screen/story` contains nine chapters and loops after 100 seconds. The final community line appears at 94 seconds while the camera gently widens. Chapter 7 branches energy to five existing houses; chapter 8 follows one existing window into a separate procedural room; chapter 9 animates the plug connection and changes a canvas laptop from 1% low battery to charging.

The existing chapter timer, camera rig, canvas, chrome, labels, and hotspot cards have an opt-in rail mode. Other screens retain their named shots and visitor pause behavior. Pill selection seeks to rail time; dragging offsets the moving camera and eases back after three seconds of inactivity.

The energy line uses the existing tower cable and pylon wire samples. Its glow is an educational overlay, including the underground connector, rather than a surveyed grid route. Generator magnets are illustrative; their count is not a turbine specification. The converter stays at the tower base. The selected house and gamer are representative, not a named resident or address. Local copy about Avonmouth, Lawrence Weston, Bristol, ACE ownership and community income comes from existing app copy. Homes powered uses the existing live homes-equivalent calculation and is labelled an estimate.

The room is at a separate scene location. Blur and a dissolve mask the continuous rail's transit through the window. The outdoor scene is hidden in the room and restored on replay; keyboard keys are instanced. The laptop's 1% is the requested fictional battery state, not turbine telemetry or an accelerated charge estimate.

Checks:

```sh
npm run build
tsc --noEmit
node frontend/src/three/storyTimeline.test.mjs
```

The TypeScript configuration checks the new rail and timeline modules; it does not migrate the existing JavaScript app. A host without `tsc` can use `npm exec --package=typescript -- tsc --noEmit` without changing the dependency manifests.

For repeatable chapter frames, use `/screen/story?debug&storyTime=35`. `storyTime` freezes camera time while live telemetry and generator animation continue. The hidden `data-story-state` output includes camera positions in scene metres. Normal playback is `/screen/story`.

Production-display 60 fps has not been certified. Automated browser measurements were below that target; final hardware performance work remains necessary.
