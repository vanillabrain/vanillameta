/**
 *
 * @param position
 */
export const getLegendOption = position => {
  let option = {};
  switch (position) {
    case 'left':
      option = {
        orient: 'vertical',
        left: 10,
        top: 'center',
      };
      break;
    case 'right':
      option = {
        orient: 'vertical',
        right: 10,
        top: 'center',
      };
      break;
    case 'top':
      option = {
        orient: 'horizontal',
        top: 'top',
      };
      break;
    case 'bottom':
      option = {
        orient: 'horizontal',
        top: 'bottom',
      };
      break;
  }
  return option;
};

/**
 *
 * @param position
 */

export const getGridSize = position => {
  let option = {};
  switch (position) {
    case 'left':
      option = { top: 50, right: 10, bottom: 50, left: 100 };
      break;
    case 'right':
      option = { top: 50, right: 100, bottom: 50, left: 10 };
      break;
    case 'top':
      option = { top: 80, right: 50, bottom: 20, left: 50 };
      break;
    case 'bottom':
      option = { top: 20, right: 50, bottom: 80, left: 50 };
      break;
  }
  return option;
};
