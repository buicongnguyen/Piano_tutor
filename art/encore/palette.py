"""Stillnote Encore style bible: one shared sRGB palette and material finishes.

Every generator imports this so the stage, the world kit and the characters
read as one toy box. Colour is vivid and warm (never pastel or beige-muddy);
night scenes keep the sky and water very dark blue and carry colour in lights.

    from palette import P, toy
    body = toy('Ship Lacquer', P['cherry'], 'gloss')
"""
from aaa_kit import mat

P = {
    # Brand and lane colours (lane order matches src/game/theme.ts LANE_COLORS)
    'coral': '#ff4f4f', 'tangerine': '#ff9416', 'sunshine': '#ffd02a', 'lime': '#5fd84a',
    'sky': '#2fb2ff', 'violet': '#8f5bff', 'berry': '#ff3d7f', 'mint': '#20d3b0',
    'royal': '#3159ff', 'cherry': '#e8282f', 'navy': '#18205a',
    # Piano materials
    'ivory': '#fff8ea', 'ebony': '#15131f', 'gold': '#ffbf2e', 'brass': '#e19a2c', 'felt': '#d7263d',
    # Nature
    'grass': '#5cc93a', 'grass_deep': '#2f9c35', 'leaf': '#3fc24a', 'leaf_deep': '#1f8f3d',
    'blossom': '#ff7fae', 'blossom_deep': '#f0508a', 'maple': '#ff6a1f', 'maple_deep': '#d8401c',
    'sunflower': '#ffc81f', 'snow': '#f3f7ff', 'ice': '#9fe3ff', 'sand': '#ffd98a',
    'bark': '#8a4a24', 'bark_deep': '#5e2f17', 'rock': '#8f96b3', 'rock_deep': '#5f6688',
    'soil': '#b0602c', 'water': '#159be0', 'water_night': '#07143a',
    # Buildings
    'wall_cream': '#fff0cf', 'wall_peach': '#ffc59a', 'wall_mint': '#b9f2d6', 'wall_sky': '#bfe4ff',
    'roof_red': '#ec3d2e', 'roof_blue': '#2f6fe8', 'roof_teal': '#12b3a6', 'roof_orange': '#ff8a1c',
    'roof_purple': '#7d4dff', 'wood': '#c46a2b', 'wood_deep': '#7f3b17', 'window_glow': '#ffcf5c',
    'stone': '#d7c9b2', 'stone_deep': '#a9947a', 'neon_pink': '#ff3fb4', 'neon_cyan': '#2ff3ff',
    # Characters
    'coda': '#ffb81f', 'coda_deep': '#ff8a00', 'coda_flag': '#ff4f4f', 'eye': '#1b1733',
    'hush': '#b8bdd9', 'hush_deep': '#8a90b8', 'hush_cap': '#5b62a8', 'cheek': '#ff7a8a',
}

# name -> (roughness, metallic)
FINISH = {
    'gloss': (0.26, 0.0),     # lacquered toy plastic: MK8 body paint
    'satin': (0.45, 0.0),     # painted wood, roofs
    'matte': (0.72, 0.0),     # foliage, rock, fabric
    'metal': (0.28, 0.9),     # gold trim, brass
    'glass': (0.08, 0.0),
}


def toy(name, color, finish='gloss', emit=0.0, alpha=1.0, double=False, emit_color=None):
    """A named palette material. `color` may be a palette key or '#rrggbb'."""
    c = P.get(color, color)
    rough, metal = FINISH[finish]
    ec = P.get(emit_color, emit_color) if emit_color else None
    return mat(name, c, rough=rough, metal=metal, emit=emit, alpha=alpha, double=double, emit_color=ec)
