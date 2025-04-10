// eslint-disable-next-line no-restricted-imports
import styled from "@emotion/styled";

export const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 16.5rem;
  padding: 1rem;
`;

// react-css inserts inline styles, but it's forbidden with our CSP headers
// to fix this we copy relevant styles here
// https://github.com/casesandberg/react-color/blob/v2.18.1/src/components/common/Hue.js#L78
// https://github.com/casesandberg/react-color/blob/v2.18.1/src/components/common/Saturation.js#L94
// eslint-disable-next-line no-color-literals
export const ControlsRoot = styled.div`
  .hue-horizontal {
    background: linear-gradient(
      to right,
      #f00 0%,
      #ff0 17%,
      #0f0 33%,
      #0ff 50%,
      #00f 67%,
      #f0f 83%,
      #f00 100%
    );
  }

  .saturation-white {
    background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
  }

  .saturation-black {
    background: linear-gradient(to top, #000, rgba(0, 0, 0, 0));
  }
`;

export const SaturationContainer = styled.div`
  position: relative;
  height: 10rem;
  margin-bottom: 1rem;
  border-radius: 0.25rem;
  overflow: hidden;
`;

export const HueContainer = styled.div`
  position: relative;
  height: 0.5rem;
  border-radius: 0.25rem;
  overflow: hidden;
`;

const ControlsPointer = styled.div`
  border: 2px solid var(--mb-color-bg-white);
  border-radius: 50%;
  pointer-events: none;
`;

export const SaturationPointer = styled(ControlsPointer)`
  width: 0.875rem;
  height: 0.875rem;
  transform: translate(-50%, -50%);
`;

export const HuePointer = styled(ControlsPointer)`
  width: 0.625rem;
  height: 0.625rem;
  transform: translate(-50%, -0.0625rem);
`;
