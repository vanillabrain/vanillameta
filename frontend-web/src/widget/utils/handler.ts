export const handleChange = (event, setOption) => {
  setOption(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
};

export const handleSeriesChange = (event, setOption, prop = 'series', innerProp = undefined) => {
  let key, index;

  if (!isNaN(event.target.name.slice(-1))) {
    // e.t.name에 숫자가 붙어 있을 경우
    key = event.target.name.slice(0, -1);
    index = Number(event.target.name.slice(-1)[0]) - 1;
  } else {
    key = event.target.name;
    index = 0;
  }

  setOption(prevState => {
    const obj = { ...prevState };

    if (Array.isArray(obj[prop])) {
      // onChange 일어난 요소 key와 index로 식별해서 value 주기
      obj[prop].forEach((item, idx) => {
        // console.log('item', item);
        // console.log('key: ', key, ', value: ', event.target.value);
        if (index === idx) {
          item[key] = event.target.value;
        }
      });
      return obj;
    }

    if (obj[prop] instanceof Object) {
      obj[prop][innerProp] = event.target.value;
      return obj;
    }
  });
};

export const handleAddClick = (event, option, setOption, defaultSeries, prop = 'series') => {
  setOption(prevState => {
    const obj = { ...prevState };
    const defaultColor = [
      '#2870c5',
      '#47a8ea',
      '#4ecef6',
      '#9e9e9f',
      '#506175',
      '#994ff6',
      '#bf6fff',
      '#fa5b5b',
      '#fca136',
      '#fccc25',
      '#95ce5b',
      '#2dab66',
    ];
    const newItem = {
      ...defaultSeries,
      color: defaultColor[option[prop].length % 12],
    };
    obj[prop].push(newItem);
    return obj;
  });
};

export const handleRemoveClick = (event, index, option, setOption, prop = 'series') => {
  if (option[prop].length === 1) {
    return;
  }

  setOption(prevState => {
    const obj = { ...prevState };
    obj[prop].splice(index, 1);
    return obj;
  });
};
