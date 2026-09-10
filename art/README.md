# Moonlit piano stage

Original procedural Blender artwork created for Stillnote. No external models,
textures or image-generation service used. The decorative digital piano has 35
white keys; the playable browser keyboard remains a separate HTML instrument.

- Editable scene: `moonlit-piano.blend` (Blender 4.5.3 LTS).
- Generator: `../scripts/render-river-stage.py` (deterministic random seed 18).
- Desktop: `../public/art/moonlit-piano.png`, 1600 × 520.
- Mobile: `../public/art/moonlit-piano-mobile.png`, 800 × 260.
- Cycles CPU, 24 samples, denoising, AgX, compositor fog glow.

Rebuild from the repository root in PowerShell:

```powershell
& 'C:/Users/n/source/repos/3d_astra/.tools/blender-4.5.3-windows-x64/blender.exe' --background --factory-startup --python scripts/render-river-stage.py
```

Rendering replaces the scene and both PNGs. Preserve any manual `.blend` edits
under a different name before regenerating. The `.blend` stays in source control;
only the two PNGs are shipped to the public site. An optional real-time 3D scene
is deliberately outside this hybrid release.
