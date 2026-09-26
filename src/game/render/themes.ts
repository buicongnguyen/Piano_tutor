// Look and dressing for every island mood. Colours are sRGB hex. Night themes
// keep a very dark blue sky and black-blue water; the colour lives in lights.
import type { ThemeId } from "../campaign";

export type Weather = "petals" | "snow" | "leaves" | "fireflies" | "confetti" | "bubbles" | "sparkles" | "none";

export type Theme = {
  id: ThemeId;
  night: boolean;
  sky: { zenith: string; horizon: string; glow: string; sun: [number, number, number]; stars: number; moon: number };
  fog: { color: string; near: number; far: number };
  water: { deep: string; shallow: string; foam: string };
  light: { sun: string; sunIntensity: number; hemiSky: string; hemiGround: string; hemi: number };
  road: { deck: string; line: string; side: string; trim: string };
  arch: string;
  islandTop: string; // Island Top tint
  foliage?: string; // optional retint for Foliage materials
  weather: Weather;
  bloom: [number, number, number]; // strength, radius, threshold
  exposure: number;
  landmark: string[]; // destination island centrepieces
  props: string[]; // islet dressing, weighted by repetition
  houses: string[];
};

export const THEMES: Record<ThemeId, Theme> = {
  meadow: {
    id: "meadow",
    night: false,
    sky: { zenith: "#2f8cff", horizon: "#bfe8ff", glow: "#fff1c4", sun: [-0.4, 0.55, -0.75], stars: 0, moon: 0 },
    fog: { color: "#bfe3ff", near: 90, far: 420 },
    water: { deep: "#0a78d8", shallow: "#27c6f2", foam: "#e9fbff" },
    light: { sun: "#fff0d2", sunIntensity: 2.6, hemiSky: "#cfe8ff", hemiGround: "#6fa03f", hemi: 1.1 },
    road: { deck: "#3a2d8f", line: "#ffe36b", side: "#ff5a4a", trim: "#ffc53d" },
    arch: "#3159ff",
    islandTop: "#5cc93a",
    weather: "petals",
    bloom: [0.45, 0.5, 0.86],
    exposure: 1.02,
    landmark: ["Windmill", "Beacon"],
    props: ["Tree_Round", "Tree_Round", "Tree_Blossom", "Flower_Patch", "Bush", "Rock", "Tree_Pine"],
    houses: ["House_Cottage", "House_Round", "House_Tall"],
  },
  snow: {
    id: "snow",
    night: true,
    sky: { zenith: "#050b2a", horizon: "#1d2f6b", glow: "#6f8cff", sun: [0.3, 0.45, -0.8], stars: 1, moon: 1 },
    fog: { color: "#15204a", near: 80, far: 380 },
    water: { deep: "#040b24", shallow: "#0d2152", foam: "#bcd4ff" },
    light: { sun: "#a9c0ff", sunIntensity: 1.1, hemiSky: "#6f86d8", hemiGround: "#2b3350", hemi: 1.0 },
    road: { deck: "#1c2a6e", line: "#ffd36b", side: "#e8282f", trim: "#ffc53d" },
    arch: "#e8282f",
    islandTop: "#f3f7ff",
    weather: "snow",
    bloom: [0.85, 0.55, 0.72],
    exposure: 1.15,
    landmark: ["Tree_Xmas", "Beacon"],
    props: ["Tree_SnowPine", "Tree_SnowPine", "Snowman", "Rock", "Lantern_Post"],
    houses: ["House_Cottage", "House_Tall", "House_Round"],
  },
  festival: {
    id: "festival",
    night: false,
    sky: { zenith: "#3b5bd6", horizon: "#ffb35c", glow: "#ffcf7a", sun: [0.55, 0.2, -0.8], stars: 0.1, moon: 0 },
    fog: { color: "#ffbf85", near: 80, far: 380 },
    water: { deep: "#1c2c8c", shallow: "#3a68df", foam: "#ffe2bf" },
    light: { sun: "#ffc48a", sunIntensity: 2.4, hemiSky: "#ffd7a8", hemiGround: "#6b5a3a", hemi: 1.0 },
    road: { deck: "#6a1f7a", line: "#ffd02a", side: "#ff4f4f", trim: "#ffc53d" },
    arch: "#ff4f4f",
    islandTop: "#6cc23a",
    weather: "confetti",
    bloom: [0.7, 0.55, 0.78],
    exposure: 1.05,
    landmark: ["Beacon", "Balloon_Hot"],
    props: ["Lantern_Post", "Lantern_Post", "Bunting", "Tree_Round", "Tree_Blossom", "Flower_Patch"],
    houses: ["House_Round", "House_Cottage", "Tent_Circus"],
  },
  pier: {
    id: "pier",
    night: false,
    sky: { zenith: "#1e8bff", horizon: "#aee9ff", glow: "#fff4c9", sun: [0.45, 0.62, -0.65], stars: 0, moon: 0 },
    fog: { color: "#b4e6ff", near: 90, far: 420 },
    water: { deep: "#0071d6", shallow: "#1fd1e6", foam: "#ffffff" },
    light: { sun: "#fff3d6", sunIntensity: 2.8, hemiSky: "#d4efff", hemiGround: "#caa56a", hemi: 1.1 },
    road: { deck: "#d9282f", line: "#fff4d6", side: "#2f6fe8", trim: "#ffc53d" },
    arch: "#ff9416",
    islandTop: "#ffd98a",
    weather: "confetti",
    bloom: [0.4, 0.45, 0.88],
    exposure: 1.02,
    landmark: ["FerrisWheel", "Tent_Circus"],
    props: ["Tree_Palm", "Tree_Palm", "Boat_Sail", "Pier", "Bunting", "Rock"],
    houses: ["Tent_Circus", "House_Round", "House_Cottage"],
  },
  garden: {
    id: "garden",
    night: false,
    sky: { zenith: "#2c9bff", horizon: "#d8f7d6", glow: "#fff6c8", sun: [-0.5, 0.6, -0.6], stars: 0, moon: 0 },
    fog: { color: "#d2f2e0", near: 90, far: 400 },
    water: { deep: "#0a8a9e", shallow: "#35e0c2", foam: "#f2fff9" },
    light: { sun: "#fff4d8", sunIntensity: 2.6, hemiSky: "#e1f7ff", hemiGround: "#5aa048", hemi: 1.1 },
    road: { deck: "#146b5c", line: "#ffe36b", side: "#ff7fae", trim: "#ffc53d" },
    arch: "#20d3b0",
    islandTop: "#4fc441",
    weather: "petals",
    bloom: [0.45, 0.5, 0.86],
    exposure: 1.02,
    landmark: ["Glasshouse", "Fountain"],
    props: ["Tree_Blossom", "Tree_Round", "Flower_Patch", "Flower_Patch", "Sunflower_Patch", "Bush"],
    houses: ["House_Round", "Glasshouse", "House_Cottage"],
  },
  neon: {
    id: "neon",
    night: true,
    sky: { zenith: "#07061f", horizon: "#2a1a6e", glow: "#7a4dff", sun: [0.1, 0.25, -0.9], stars: 0.8, moon: 0 },
    fog: { color: "#1a1147", near: 70, far: 360 },
    water: { deep: "#050418", shallow: "#1b1470", foam: "#5ff3ff" },
    light: { sun: "#8f7bff", sunIntensity: 1.0, hemiSky: "#6a5cff", hemiGround: "#1b1640", hemi: 1.0 },
    road: { deck: "#120f3a", line: "#2ff3ff", side: "#ff3fb4", trim: "#2ff3ff" },
    arch: "#8f5bff",
    islandTop: "#2b2f6b",
    weather: "bubbles",
    bloom: [1.0, 0.6, 0.62],
    exposure: 1.1,
    landmark: ["Tower_Neon", "Tower_Neon"],
    props: ["Tower_Neon", "Tree_Palm", "Rock", "Crystal_Stillnote", "Lantern_Post"],
    houses: ["House_Tall", "House_Round"],
  },
  harbour: {
    id: "harbour",
    night: true,
    sky: { zenith: "#030820", horizon: "#0f1e4d", glow: "#3d5bbf", sun: [-0.35, 0.5, -0.8], stars: 1, moon: 1 },
    fog: { color: "#0b1638", near: 70, far: 360 },
    water: { deep: "#01061a", shallow: "#071a45", foam: "#9fc2ff" },
    light: { sun: "#9fb6ff", sunIntensity: 0.9, hemiSky: "#5f78c8", hemiGround: "#1a2238", hemi: 0.95 },
    road: { deck: "#0d1a4f", line: "#ffd36b", side: "#2f6fe8", trim: "#ffc53d" },
    arch: "#2f6fe8",
    islandTop: "#3d7a45",
    weather: "fireflies",
    bloom: [0.95, 0.6, 0.66],
    exposure: 1.18,
    landmark: ["Beacon", "Boat_Sail"],
    props: ["Boat_Sail", "Pier", "Rock", "Tree_Pine", "Lantern_Post"],
    houses: ["House_Tall", "House_Cottage", "House_Round"],
  },
  spring: {
    id: "spring",
    night: false,
    sky: { zenith: "#3a93ff", horizon: "#ffe0ef", glow: "#fff0f6", sun: [-0.4, 0.6, -0.7], stars: 0, moon: 0 },
    fog: { color: "#ffe3f0", near: 90, far: 400 },
    water: { deep: "#1275d8", shallow: "#48d4f0", foam: "#ffffff" },
    light: { sun: "#fff0e6", sunIntensity: 2.6, hemiSky: "#ffe6f2", hemiGround: "#6fae44", hemi: 1.1 },
    road: { deck: "#5a2a9e", line: "#ffe36b", side: "#ff7fae", trim: "#ffc53d" },
    arch: "#ff3d7f",
    islandTop: "#66d13f",
    foliage: "#ff8fbd",
    weather: "petals",
    bloom: [0.45, 0.5, 0.86],
    exposure: 1.02,
    landmark: ["Windmill", "Beacon"],
    props: ["Tree_Blossom", "Tree_Blossom", "Flower_Patch", "Tree_Round", "Bush"],
    houses: ["House_Cottage", "House_Round"],
  },
  summer: {
    id: "summer",
    night: false,
    sky: { zenith: "#0f7bff", horizon: "#9fe6ff", glow: "#fff7c2", sun: [0.3, 0.75, -0.55], stars: 0, moon: 0 },
    fog: { color: "#a6e2ff", near: 100, far: 440 },
    water: { deep: "#0066cc", shallow: "#14d4e0", foam: "#ffffff" },
    light: { sun: "#fff6dc", sunIntensity: 3.0, hemiSky: "#d0f0ff", hemiGround: "#b39a4a", hemi: 1.1 },
    road: { deck: "#c02630", line: "#fff4d6", side: "#ffc81f", trim: "#ffc53d" },
    arch: "#ff9416",
    islandTop: "#8fd63a",
    weather: "sparkles",
    bloom: [0.4, 0.45, 0.88],
    exposure: 1.02,
    landmark: ["Beacon", "Balloon_Hot"],
    props: ["Sunflower_Patch", "Sunflower_Patch", "Tree_Palm", "Tree_Round", "Boat_Sail"],
    houses: ["House_Round", "House_Cottage"],
  },
  autumn: {
    id: "autumn",
    night: false,
    sky: { zenith: "#3c6fd8", horizon: "#ffc98a", glow: "#ffd29a", sun: [0.6, 0.28, -0.75], stars: 0, moon: 0 },
    fog: { color: "#f6c89a", near: 110, far: 480 },
    water: { deep: "#183c8c", shallow: "#2d82c6", foam: "#fff1dc" },
    light: { sun: "#ffc98f", sunIntensity: 2.5, hemiSky: "#ffd9b0", hemiGround: "#8a5a2a", hemi: 1.0 },
    road: { deck: "#6b2410", line: "#ffd02a", side: "#ff6a1f", trim: "#ffc53d" },
    arch: "#d8401c",
    islandTop: "#c9a43a",
    foliage: "#ff7a1f",
    weather: "leaves",
    bloom: [0.5, 0.5, 0.84],
    exposure: 1.02,
    landmark: ["Windmill", "Beacon"],
    props: ["Tree_Maple", "Tree_Maple", "Tree_Round", "Bush", "Rock"],
    houses: ["House_Cottage", "House_Tall"],
  },
  winter: {
    id: "winter",
    night: false,
    sky: { zenith: "#4f86e8", horizon: "#e8f2ff", glow: "#ffffff", sun: [-0.3, 0.35, -0.85], stars: 0, moon: 0 },
    fog: { color: "#e2eeff", near: 80, far: 380 },
    water: { deep: "#2b64b8", shallow: "#9fe3ff", foam: "#ffffff" },
    light: { sun: "#eaf2ff", sunIntensity: 2.3, hemiSky: "#eef5ff", hemiGround: "#9fb0d0", hemi: 1.2 },
    road: { deck: "#23408f", line: "#ffffff", side: "#9fe3ff", trim: "#ffc53d" },
    arch: "#2f6fe8",
    islandTop: "#f3f7ff",
    weather: "snow",
    bloom: [0.45, 0.5, 0.86],
    exposure: 1.0,
    landmark: ["Beacon", "Tree_SnowPine"],
    props: ["Tree_SnowPine", "Tree_SnowPine", "Snowman", "Rock", "Tree_Pine"],
    houses: ["House_Cottage", "House_Tall"],
  },
  crown: {
    id: "crown",
    night: false,
    sky: { zenith: "#4a3fb8", horizon: "#ffb070", glow: "#ffd98a", sun: [0.2, 0.18, -0.95], stars: 0.2, moon: 0 },
    fog: { color: "#f3b58a", near: 120, far: 540 },
    water: { deep: "#28258c", shallow: "#5663e6", foam: "#fff0e0" },
    light: { sun: "#ffc890", sunIntensity: 2.4, hemiSky: "#ffd8b8", hemiGround: "#6a5aa0", hemi: 1.05 },
    road: { deck: "#2a1f7a", line: "#ffd02a", side: "#ffc53d", trim: "#fff4d6" },
    arch: "#ffbf2e",
    islandTop: "#f6f0ff",
    weather: "sparkles",
    bloom: [0.7, 0.55, 0.76],
    exposure: 1.05,
    landmark: ["Carillon_Tower"],
    props: ["Cloud_Puff", "Crystal_Stillnote", "Lantern_Post", "Tree_Round"],
    houses: ["House_Round", "House_Tall"],
  },
};

// Lane colours match art/encore/palette.py (coral → violet).
export const LANE_COLORS = ["#ff4f4f", "#ff9416", "#ffd02a", "#5fd84a", "#2fb2ff", "#8f5bff"];
export const LANE_SETS: Record<number, number[]> = { 4: [0, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

/** Pitch-class colours for real-piano mode (a Boomwhacker-like rainbow). */
export const PITCH_COLORS = [
  "#ff4f4f", // C
  "#ff6f3a",
  "#ff9416", // D
  "#ffb21f",
  "#ffd02a", // E
  "#5fd84a", // F
  "#2fcf8f",
  "#2fb2ff", // G
  "#4f86ff",
  "#6f6bff", // A
  "#8f5bff",
  "#d35bff", // B
];
