import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import SwiperCore, { Navigation } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <div className="mb-10 flex flex-col gap-6 p-4 pb-0">
      <p className="text-lg font-medium">Layout1</p>
      <div className="relative isolate m-auto h-[46.875vw] max-h-[calc(70vh-200px)] w-full rounded-[4px] bg-[#eee]">
        {slideData[activeSlide]}

        <div className="absolute inset-x-0 bottom-[-50px] z-10 mx-auto flex h-[35%] max-h-[180px] min-h-[100px] w-[40%] min-w-[300px] max-w-[700px] items-end">
          <div className="absolute inset-x-0 top-1/2 bottom-1/2 z-20 flex h-0 w-full flex-row-reverse items-center justify-between">
            <Button ref={navigationNextRef} variant="ghost" className="flex h-[100px] items-center rounded-none">
              <ArrowRight />
            </Button>
            <Button ref={navigationPrevRef} variant="ghost" className="flex h-[100px] items-center rounded-none">
              <ArrowLeft />
            </Button>
          </div>

          <Swiper className="h-full w-[calc(100%-60px)]" {...swiperParams}>
            {slideData.map((item, index) => (
              <SwiperSlide key={item}>
                <Card
                  className={cn(
                    'm-1 h-[calc(100%-16px)] py-0 shadow-md',
                    activeSlide === index && 'outline-3 outline-black',
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    name={item}
                    className="h-full w-full rounded-none text-center"
                    onClick={handleClick}
                  >
                    {item}
                  </Button>
                </Card>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </div>
  );
}

export default SecondStep;
