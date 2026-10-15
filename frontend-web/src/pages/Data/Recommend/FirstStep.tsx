import React from 'react';
import { useTranslation } from 'react-i18next';
import TitleBox from '@/components/TitleBox';
import SmallCardList from '@/components/SmallCardList';

function FirstStep(props) {
  const { t } = useTranslation();
  const { data } = props;

  return (
    <div className="flex flex-col gap-6 p-4 pb-0">
      <p className="mb-4">{t('dataRecommend2.guideData')}</p>
      <div>
        <TitleBox title={t('dataRecommend2.dataset')}>
          <SmallCardList data={data.dataSet} />
        </TitleBox>
      </div>
      <div>
        <TitleBox title={t('dataRecommend2.dataList')}>
          <SmallCardList data={data.dataList} />
        </TitleBox>
      </div>
    </div>
  );
}

export default FirstStep;
