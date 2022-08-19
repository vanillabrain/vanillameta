import React, { useRef, useState } from 'react';
import { Stack, Typography, Box, Card, CardActionArea, IconButton, styled } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { Swiper, SwiperSlide } from 'swiper/react';
import SwiperCore, { Navigation } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';

const StyledSwiperWrapper = styled(Box)({
  position: 'absolute',
  display: 'flex',
  alignItems: 'flex-end',
  left: 0,
  right: 0,
  bottom: -50,
  zIndex: 2000,
  width: '40%',
  minWidth: 300,
  maxWidth: 700,
  height: '35%',
  minHeight: 100,
  maxHeight: 180,
  margin: 'auto',
});

const StyledSwiper = styled(Swiper)({
  width: 'calc(100% - 60px)',
  height: '100%',
});

const StyledSwiperNavigation = styled(Box)({
  display: 'flex',
  flexDirection: 'row-reverse',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'absolute',
  top: '50%',
  bottom: '50%',
  left: 0,
  right: 0,
  zIndex: 4000,
  width: '100%',
  height: 0,

  '& .MuiIconButton-root': {
    display: 'flex',
    alignItems: 'center',
    height: 100,
    borderRadius: 0,
  },
});

function SecondStep(props) {
  const slideData = ['Slide 1', 'Slide 2', 'Slide 3', 'Slide 4', 'Slide 5'];
  const [activeSlide, setActiveSlide] = useState(0);

  const handleClick = event => {
    console.log(event.target.name);
    slideData.forEach((element, index) => {
      if (element === event.target.name) {
        setActiveSlide(index);
      }
    });
  };

  SwiperCore.use([Navigation]);
  const navigationNextRef = useRef(null);
  const navigationPrevRef = useRef(null);

  const swiperParams = {
    navigation: { prevEl: navigationPrevRef.current, nextEl: navigationNextRef.current },
    onBeforeInit: swiper => {
      swiper.params.navigation.prevEl = navigationPrevRef.current;
      swiper.params.navigation.nextEl = navigationNextRef.current;
      swiper.navigation.update();
    },
    slidesPerView: 3,
    loop: true,
  };

  return (
    <Stack p={4} pb={0} mb={5} spacing={3}>
      <Typography variant="h6" component="p">
        Layout1
      </Typography>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '46.875vw',
          maxHeight: 'calc(70vh - 200px)',
          m: 'auto',
          borderRadius: 1,
          backgroundColor: '#eee',
        }}
      >
        {slideData[activeSlide]}

        <StyledSwiperWrapper>
          <StyledSwiperNavigation>
            <IconButton ref={navigationNextRef}>
              <ArrowForward />
            </IconButton>
            <IconButton ref={navigationPrevRef}>
              <ArrowBack />
            </IconButton>
          </StyledSwiperNavigation>

          <StyledSwiper {...swiperParams}>
            {slideData.map((item, index) => (
              <SwiperSlide key={item}>
                <Card
                  elevation={3}
                  sx={{
                    height: 'calc(100% - 16px)',
                    m: 1,
                    outline: activeSlide === index && '3px solid #000',
                  }}
                >
                  <CardActionArea name={item} sx={{ height: '100%', textAlign: 'center' }} onClick={handleClick}>
                    {item}
                  </CardActionArea>
                </Card>
              </SwiperSlide>
            ))}
          </StyledSwiper>
        </StyledSwiperWrapper>
      </Box>
    </Stack>
  );
}

export default SecondStep;
