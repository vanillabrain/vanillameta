import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BigQueryDatabaseForm from './BigQueryDatabaseForm';
import DatabaseForm from './DatabaseForm';
import OracleDatabaseForm from './OracleDatabaseForm';
import SnowflakeDatabaseForm from './SnowflakeDatabaseForm';
import SqliteDatabaseForm from './SqliteDatabaseForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/** 원본 화면과 같은 폼 상태 모양. 각 그룹은 엔진별 connectionConfig로 전송된다. */
const formData = () => ({
  type: 'mysql',
  name: 'prod-db',
  default: { host: 'h', port: 3306, user: 'u', password: 'p', database: 'd' },
  sqlite: { filename: '/tmp/a.db' },
  bigquery: { projectId: 'p1', keyFilename: 'k.json', schema: 's' },
  oracle: {
    host: 'oh',
    port: 1521,
    user: 'ou',
    password: 'op',
    database: 'od',
    instanceName: 'oi',
    fetchAsString: 'y',
    requestTimeout: '30',
  },
  snowflake: {
    account: 'ac',
    username: 'sn',
    password: 'sp',
    database: 'sd',
    application: 'ap',
    schema: 'ss',
    warehouse: 'wh',
  },
});

/**
 * 폼 핸들러는 브라우저의 HTMLFormElement named 접근(data.target.<name>)에 의존한다.
 * jsdom에는 그 getter가 없으므로 [name] 컨트롤을 같은 이름의 폼 속성으로 노출해 동작을 재현한다.
 */
const browserFormAccess = (form: HTMLFormElement) => {
  form.querySelectorAll<HTMLElement>('[name]').forEach(control => {
    const name = control.getAttribute('name');
    if (name) {
      Object.defineProperty(form, name, { value: control, configurable: true });
    }
  });
  return form;
};

const submitForm = (container: HTMLElement) => fireEvent.submit(browserFormAccess(container.querySelector('form')));

/** 실제 화면처럼 폼 상태를 보유해 controlled input이 변경 뒤에도 값을 유지하게 한다. */
const FormHarness = ({ Form, initial }: { Form: React.ComponentType<any>; initial?: any }) => {
  const [form, setForm] = React.useState(initial ?? formData());
  return <Form testConnect={vi.fn()} formData={form} setFormData={setForm} />;
};

afterEach(cleanup);

describe('database connection forms keep the original submit payload', () => {
  it('sends the default engine connection config with a numeric port', () => {
    const testConnect = vi.fn();
    const { container } = render(<DatabaseForm testConnect={testConnect} formData={formData()} setFormData={vi.fn()} />);
    submitForm(container);
    expect(testConnect).toHaveBeenCalledTimes(1);
    expect(testConnect).toHaveBeenCalledWith({
      name: 'prod-db',
      host: 'h',
      port: 3306,
      user: 'u',
      password: 'p',
      database: 'd',
    });
  });

  it('sends the sqlite file name', () => {
    const testConnect = vi.fn();
    const { container } = render(
      <SqliteDatabaseForm testConnect={testConnect} formData={formData()} setFormData={vi.fn()} />,
    );
    submitForm(container);
    expect(testConnect).toHaveBeenCalledWith({ name: 'prod-db', filename: '/tmp/a.db' });
  });

  it('sends the bigquery project, key file and schema', () => {
    const testConnect = vi.fn();
    const { container } = render(
      <BigQueryDatabaseForm testConnect={testConnect} formData={formData()} setFormData={vi.fn()} />,
    );
    submitForm(container);
    expect(testConnect).toHaveBeenCalledWith({ name: 'prod-db', projectId: 'p1', keyFilename: 'k.json', schema: 's' });
  });

  it('sends the oracle config with a numeric port and string request timeout', () => {
    const testConnect = vi.fn();
    const { container } = render(
      <OracleDatabaseForm testConnect={testConnect} formData={formData()} setFormData={vi.fn()} />,
    );
    submitForm(container);
    expect(testConnect).toHaveBeenCalledWith({
      name: 'prod-db',
      host: 'oh',
      port: 1521,
      user: 'ou',
      password: 'op',
      database: 'od',
      instanceName: 'oi',
      fetchAsString: 'y',
      requestTimeout: '30',
    });
  });

  it('sends the snowflake account config', () => {
    const testConnect = vi.fn();
    const { container } = render(
      <SnowflakeDatabaseForm testConnect={testConnect} formData={formData()} setFormData={vi.fn()} />,
    );
    submitForm(container);
    expect(testConnect).toHaveBeenCalledWith({
      name: 'prod-db',
      account: 'ac',
      username: 'sn',
      password: 'sp',
      database: 'sd',
      application: 'ap',
      schema: 'ss',
      warehouse: 'wh',
    });
  });
});

describe('database connection forms keep the original change contract', () => {
  it('writes the shared name at the top level without touching engine groups', () => {
    const { container } = render(<FormHarness Form={DatabaseForm} />);
    const name = container.querySelector<HTMLInputElement>('input[name=name]');
    fireEvent.change(name, { target: { value: 'renamed' } });
    expect(name.value).toBe('renamed');
    expect(container.querySelector<HTMLInputElement>('input[name=host]').value).toBe('h');
    expect(container.querySelector<HTMLInputElement>('input[name=port]').value).toBe('3306');
  });

  it('writes engine values into their own group', () => {
    const { container } = render(<FormHarness Form={SnowflakeDatabaseForm} />);
    const warehouse = container.querySelector<HTMLInputElement>('input[name=warehouse]');
    fireEvent.change(warehouse, { target: { value: 'wh2' } });
    expect(warehouse.value).toBe('wh2');
    expect(container.querySelector<HTMLInputElement>('input[name=account]').value).toBe('ac');
    expect(container.querySelector<HTMLInputElement>('input[name=schema]').value).toBe('ss');
    expect(container.querySelector<HTMLInputElement>('input[name=name]').value).toBe('prod-db');
  });
});
