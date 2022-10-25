import React from 'react';
import { Box, Stack } from '@mui/material';

const PaintButton = ({ color }) => {
  return (
    <Stack justifyContent="center" alignItems="center" gap="4px">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#zp0ysd0z5a)">
          <path
            d="M7.45 19.05c-.67 0-1.3-.26-1.77-.73l-4.24-4.24c-.47-.47-.73-1.1-.73-1.77 0-.67.26-1.3.73-1.77l6.72-6.72 7.78 7.78-6.72 6.72c-.47.47-1.1.73-1.77.73z"
            fill="#fff"
          />
          <path
            d="m8.16 4.53 7.07 7.07-6.36 6.36c-.39.39-.9.59-1.41.59-.51 0-1.02-.2-1.41-.59L1.8 13.72c-.78-.78-.78-2.05 0-2.83l6.36-6.36zm0-1.41-.71.71-6.36 6.36c-.57.57-.88 1.32-.88 2.12s.31 1.55.88 2.12l4.24 4.24c.57.57 1.32.88 2.12.88s1.55-.31 2.12-.88l6.36-6.36.71-.71-.71-.71-7.06-7.07-.71-.71v.01z"
            fill="#333"
          />
          <path
            d="M14.84 7.65c1.78 0 4.16 1 4.23 4.23v3.32a.56.56 0 1 1-1.12 0c0-1.14-.2-3.43-.91-3.48L14.3 8.97a.768.768 0 0 1 .55-1.31l-.01-.01z"
            fill="#333"
          />
          <path
            d="M8.51 17.61c-.57.57-1.55.57-2.12 0l-4.24-4.24a1.499 1.499 0 0 1 0-2.12l2.1-2.1h7.82l2.45 2.45-6.01 6.01z"
            fill={color}
          />
          <path
            d="m3.32 7.88-1.57-2.3c-.62-.91-.2-2.28.94-3.06 1.14-.78 2.57-.67 3.19.24l3.39 4.95c.62.91.2 2.28-.94 3.06"
            stroke="#333"
            strokeMiterlimit="10"
            strokeLinecap="round"
          />
        </g>
        <defs>
          <clipPath id="zp0ysd0z5a">
            <path fill="#fff" d="M0 0h20v20H0z" />
          </clipPath>
        </defs>
      </svg>
      <Box sx={{ width: '28px', height: '6px', border: '1px solid #bdc2d0', backgroundColor: color }} />
    </Stack>
  );
};

export default PaintButton;
