const React = require('react');

// `import src from '*.svg'` (URL 문자열) 과 `import { ReactComponent } from '*.svg'` 둘 다 지원하는 목.
const ReactComponent = props => React.createElement('svg', props);

module.exports = {
  __esModule: true,
  default: 'test-asset-file',
  ReactComponent,
};
