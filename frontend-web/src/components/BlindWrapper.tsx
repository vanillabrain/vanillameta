// import { styled } from '@mui/material';
import styled from 'styled-components';

const BlindWrapper = styled('span')`
  display: block;
  position: absolute;
  z-index: -1;
  width: 0;
  height: 0;
  overflow: hidden;
  & a {
    display: block;
    width: 100%;
    height: 100%;
    background-image: ${props => props.imgUrl || 'none'};
    background-repeat: no-repeat;
    background-size: contain;
    background-position: 50% 50%;
  }
`;
export default BlindWrapper;
