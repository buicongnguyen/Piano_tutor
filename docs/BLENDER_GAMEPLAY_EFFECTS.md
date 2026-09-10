# Blender gameplay effects

The previous Blender scene improved the background. This change puts Blender
art directly at the keys during play.

1. Model and light an original faceted cyan crystal in Blender; retain the scene
   and render a small transparent PNG.
2. Add “3D crystal bursts” to the existing Effect selection. Keep the saved default.
3. Emit short, layered crystal bursts at piano and computer key positions when
   they become active, including manual input and score playback.
4. Use depth through different sizes, rotation, and trajectories. These are
   animated sprites rendered from a 3D model, not a real-time 3D renderer.
5. Limit particle count, remove expired particles, ignore hidden/offscreen keys,
   and clear effects when disabled, when the page hides, or reduced motion applies.
6. Review behavior, run tests/build, inspect the render and browser, then publish.
