import React from 'react';
import { ROUTE_URL } from '@/constant';
import { Helmet } from 'react-helmet-async';

const SEO = props => {
  const {
    title = 'Vanilla Meta',
    description = '최신 엔터프라이즈용 비즈니스 인텔리전스 웹 애플리케이션, Vanilla Meta',
    image = '%PUBLIC_URL%/static/images/logo/logo.png',
    url = ROUTE_URL,
  } = props;
  return (
    <Helmet>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title + ' - Vanilla Meta'}</title>

      {/* og */}
      <meta property="og:title" content={title + ' - Vanilla Meta'} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Vanilla Meta" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title + ' - Vanilla Meta'} />
      <meta property="twitter:image" content={image} />
      <meta name="twitter:site" content={url} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default SEO;
