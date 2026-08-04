const MAT_MOTION_EASE = {
  enter: [0.16, 1, 0.3, 1],
  slide: [0.22, 1, 0.36, 1],
} as const;

const MAT_MOTION_DURATION = {
  fast: 0.18,
  standard: 0.24,
  gallery: 0.4,
  originFill: 0.5,
} as const;

const MAT_MOTION_DISTANCE = {
  menu: 8,
  selection: 4,
} as const;

const MAT_MOTION_SCALE = {
  press: 0.985,
  whatsappHover: 1.05,
} as const;

const MAT_MOTION_SWIPE = {
  distance: 56,
  velocity: 500,
} as const;

function getMatMotionTransition(
  duration: number,
  reducedMotion: boolean,
  ease: readonly [number, number, number, number] = MAT_MOTION_EASE.enter,
) {
  return {
    duration: reducedMotion ? 0 : duration,
    ease,
  };
}

export {
  getMatMotionTransition,
  MAT_MOTION_DISTANCE,
  MAT_MOTION_DURATION,
  MAT_MOTION_EASE,
  MAT_MOTION_SCALE,
  MAT_MOTION_SWIPE,
};
