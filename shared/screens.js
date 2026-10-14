// The public hoarding screens, and the animations a visitor's phone may ask a screen to play.
// Only these fixed actions ever travel to a screen; visitor text never does.

export const SCREENS = [
  { id: "students", title: "Students" },
  { id: "community", title: "Community" },
  { id: "college", title: "College" },
  { id: "story", title: "Stories" },
];

export const SCREEN_IDS = SCREENS.map((s) => s.id);

export const SCREEN_ACTIONS = {
  look_inside: "Open the turbine and fly into the machine room",
  tower_inside: "Open the turbine and look up inside the tower",
  close_inside: "Close the turbine again",
  fly_to_nacelle: "Fly the camera to the nacelle",
  fly_to_base: "Fly the camera to the tower base",
  overview: "Return to the wide shot",
  spin_blades: "Give the blades a playful spin",
  walk_start: "Start the first-person climb up the tower",
  walk_stop: "End the climb",
  walk_to: "Move the climb to a point between the base (0) and the nacelle (1)",
};

export const SCREEN_ACTION_IDS = Object.keys(SCREEN_ACTIONS);
