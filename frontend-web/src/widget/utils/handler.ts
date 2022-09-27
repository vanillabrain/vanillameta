export const handleChange = (event, setOption) => {
  setOption(prevState => ({ ...prevState, [event.target.name]: event.target.value }));
};

export const handleSeriesChange = (event, setOption, prop = 'series') => {
  const key = event.target.name.slice(0, -1);
  const index = Number(event.target.name.slice(-1)[0]) - 1;

  setOption(prevState => {
    const obj = { ...prevState };

    // onChange 일어난 요소 key와 index로 식별해서 value 주기
    obj[prop].forEach((item, idx) => {
      console.log('item', item);
      console.log('key: ', key, ', value: ', event.target.value);
      if (index === idx) {
        item[key] = event.target.value;
      }
    });
    return obj;
  });
};

export const handleAddClick = (event, option, setOption, defaultSeries, prop = 'series') => {
  setOption(prevState => {
    const obj = { ...prevState };
    const defaultColor = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];
    const newItem = {
      ...defaultSeries,
      color: defaultColor[option[prop].length % 9],
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
