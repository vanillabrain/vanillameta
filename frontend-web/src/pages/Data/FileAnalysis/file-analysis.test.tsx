import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileAnalysis from './index';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  close: vi.fn(),
  connect: vi.fn(),
  instantiate: vi.fn(),
  terminate: vi.fn(),
  register: vi.fn(),
  workerTerminate: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  upload: vi.fn(),
  option: null as any,
  gridData: null as any,
  gridColumns: null as any,
}));

vi.mock('@duckdb/duckdb-wasm', () => ({
  selectBundle: async () => ({ mainModule: 'wasm', mainWorker: 'worker' }),
  VoidLogger: class {},
  AsyncDuckDB: class {
    instantiate = state.instantiate;
    terminate = state.terminate;
    connect = state.connect;
    registerFileHandle = state.register;
  },
  DuckDBDataProtocol: { BROWSER_FILEREADER: 2 },
}));
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url', () => ({ default: 'mvp' }));
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url', () => ({ default: 'eh' }));
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url', () => ({ default: 'mvp-worker' }));
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url', () => ({ default: 'eh-worker' }));
vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    state.option = props.option;
    return <div data-testid="chart" />;
  },
}));
vi.mock('@toast-ui/react-grid', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props: any, ref) => {
      React.useImperativeHandle(ref, () => ({ getInstance: () => ({ refreshLayout: vi.fn() }) }));
      state.gridData = props.data;
      state.gridColumns = props.columns;
      props.data.forEach((row: any, index: number) => {
        if (!Object.prototype.hasOwnProperty.call(row, 'rowKey')) row.rowKey = index;
        row.sortKey = index;
        row.uniqueKey = 'grid';
        row._attributes = {};
        row._disabledPriority = {};
        row.rowSpanMap = {};
        row._relationListItemMap = {};
      });
      return <div data-testid="grid" />;
    }),
  };
});
vi.mock('@mui/material', () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: Container,
    Stack: Container,
    Typography: Container,
    FormControl: Container,
    InputLabel: Container,
    Button: ({ children, disabled, onClick }: any) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    TextField: ({ value, onChange, onKeyDown }: any) => (
      <input aria-label="query" value={value} onChange={onChange} onKeyDown={onKeyDown} />
    ),
    Select: ({ label, value, onChange, children }: any) => (
      <select aria-label={label} value={value} onChange={onChange}>
        {children}
      </select>
    ),
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  };
});
vi.mock('@/components/PageTitleBox', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/button/SubmitButton', () => ({
  default: ({ label, onClick, disabled }: any) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('@/contexts/AlertContext', () => ({ SnackbarContext: {} }));
vi.mock('@/api/databaseService', () => ({ default: { uploadFile: state.upload } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: state.error, success: state.success }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const result = (rows: Record<string, unknown>[], fields: [string, number, number?][]) => ({
  schema: { fields: fields.map(([name, typeId, scale]) => ({ name, type: { typeId, scale } })) },
  toArray: () => rows.map(row => ({ toJSON: () => ({ ...row }) })),
});
const uploadResult = () =>
  result(
    [
      { category: 'A', amount: 100 },
      { category: 'B', amount: 250 },
      { category: 'C', amount: 150 },
    ],
    [
      ['category', 5],
      ['amount', 2],
    ],
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.option = null;
  state.gridData = null;
  state.gridColumns = null;
  state.instantiate.mockResolvedValue(undefined);
  state.close.mockResolvedValue(undefined);
  state.connect.mockResolvedValue({ query: state.query, close: state.close });
  state.query.mockImplementation(async (sql: string) => (sql.startsWith('SELECT') ? uploadResult() : undefined));
  state.register.mockResolvedValue(undefined);
  state.upload.mockResolvedValue({ data: { status: 'SUCCESS', data: { rows: 3, id: 1 } } });
  vi.stubGlobal(
    'Worker',
    class {
      terminate = state.workerTerminate;
    },
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mountReady = async () => {
  const view = render(<FileAnalysis />);
  await waitFor(() => expect((screen.getByText('fileAnalysis.selectFile') as HTMLButtonElement).disabled).toBe(false));
  return view;
};
const upload = async (view: ReturnType<typeof render>, name = 'sales.csv') => {
  const file = new File(['category,amount\nA,100'], name);
  fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [file] } });
  await waitFor(() => expect(state.success).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByTestId('chart')).not.toBeNull());
  return file;
};
const query = async (sql: string, output: ReturnType<typeof result>) => {
  state.query.mockResolvedValueOnce(output);
  fireEvent.change(screen.getByLabelText('query'), { target: { value: sql } });
  fireEvent.click(screen.getByText('fileAnalysis.run'));
  await waitFor(() => expect(state.query).toHaveBeenCalledWith(sql));
  await waitFor(() => expect((screen.getByText('fileAnalysis.run') as HTMLButtonElement).disabled).toBe(false));
};
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });

const exportText = async () => {
  let blob: Blob;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((value: Blob) => {
      blob = value;
      return 'blob:export';
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  fireEvent.click(screen.getByText('fileAnalysis.exportCsv'));
  return readBlob(blob);
};

describe('FileAnalysis settled data and lifecycle regressions', () => {
  it('plots original three values and exports no grid-added fields', async () => {
    const view = await mountReady();
    await upload(view);
    expect(state.option.series[0].data).toEqual([100, 250, 150]);
    expect(await exportText()).toBe('category,amount\nA,100\nB,250\nC,150');
  });

  it.each(['csv', 'json', 'parquet'])(
    'escapes apostrophes in %s SQL while registering the original file name',
    async ext => {
      const view = await mountReady();
      const file = await upload(view, `sales'quoted.${ext}`);
      expect(state.register).toHaveBeenCalledWith(file.name, file, 2, true);
      const reader = ext === 'csv' ? 'read_csv_auto' : ext === 'json' ? 'read_json_auto' : 'read_parquet';
      expect(state.query).toHaveBeenCalledWith(
        `CREATE TABLE uploaded_data AS SELECT * FROM ${reader}('sales''quoted.${ext}')`,
      );
    },
  );

  it('clears chart and axes for an empty query and selects compatible new numeric schema fields', async () => {
    const view = await mountReady();
    await upload(view);
    await query('SELECT empty', result([], [['empty', 2]]));
    expect(screen.queryByTestId('chart')).toBeNull();
    expect(screen.queryByTestId('grid')).toBeNull();
    expect(state.error).not.toHaveBeenCalled();
    await query(
      'SELECT total',
      result(
        [{ zip: '00500', total: '500' }],
        [
          ['zip', 5],
          ['total', 7, 0],
        ],
      ),
    );
    expect((screen.getByLabelText('fileAnalysis.xAxis') as HTMLSelectElement).value).toBe('zip');
    expect((screen.getByLabelText('fileAnalysis.value') as HTMLSelectElement).value).toBe('total');
    expect(Array.from((screen.getByLabelText('fileAnalysis.value') as HTMLSelectElement).options).map(o => o.value)).toEqual(
      ['total'],
    );
    expect(state.option.series[0].data).toEqual([500]);
  });

  it('applies Arrow decimal scale and keeps unsafe BIGINT export exact with escaped headers and values', async () => {
    const view = await mountReady();
    await upload(view);
    const decimal = Object.assign(new Uint32Array([50000, 0, 0, 0]), { toString: () => '50000' });
    await query(
      'SELECT decimal',
      result(
        [{ 'quoted,"header\r': 'A,"B"\r\nC', total: decimal, rowKey: BigInt('9007199254740993') }],
        [
          ['quoted,"header\r', 5],
          ['total', 7, 2],
          ['rowKey', 2],
        ],
      ),
    );
    fireEvent.change(screen.getByLabelText('fileAnalysis.value'), { target: { value: 'total' } });
    expect(state.option.series[0].data).toEqual([500]);
    const text = await exportText();
    expect(text).toBe('"quoted,""header\r",total,rowKey\n"A,""B""\r\nC",500,9007199254740993');
  });

  it('retains compatible selected fields after another upload', async () => {
    const view = await mountReady();
    await upload(view);
    fireEvent.change(screen.getByLabelText('fileAnalysis.xAxis'), { target: { value: 'amount' } });
    state.success.mockClear();
    await upload(view, 'next.csv');
    expect((screen.getByLabelText('fileAnalysis.xAxis') as HTMLSelectElement).value).toBe('amount');
    expect((screen.getByLabelText('fileAnalysis.value') as HTMLSelectElement).value).toBe('amount');
  });

  it('closes failed file and query connections, and keeps the previous selected file after load failure', async () => {
    const view = await mountReady();
    const original = await upload(view);
    state.close.mockClear();
    state.query.mockRejectedValueOnce(new Error('load broken'));
    fireEvent.change(view.container.querySelector('input[type=file]'), {
      target: { files: [new File(['bad'], 'broken.csv')] },
    });
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('fileAnalysis.loadFailed'));
    expect(state.close).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).not.toContain('broken.csv');
    fireEvent.click(screen.getByText('fileAnalysis.saveDataset'));
    await waitFor(() => expect(state.upload).toHaveBeenCalledWith(original));
    state.close.mockClear();
    state.query.mockRejectedValueOnce(new Error('query broken'));
    fireEvent.click(screen.getByText('fileAnalysis.run'));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith('fileAnalysis.queryFailed'));
    expect(state.close).toHaveBeenCalledTimes(1);
  });

  it.each(['file', 'query'])('closes the connection after a %s result parsing error', async operation => {
    const view = await mountReady();
    await upload(view);
    state.close.mockClear();
    state.success.mockClear();
    const broken = {
      ...result([], []),
      toArray: () => {
        throw new Error('parsing failed');
      },
    };
    if (operation === 'file') {
      state.query.mockImplementation(async (sql: string) => (sql.startsWith('SELECT') ? broken : undefined));
      fireEvent.change(view.container.querySelector('input[type=file]'), {
        target: { files: [new File(['bad'], 'parsing.csv')] },
      });
    } else {
      state.query.mockResolvedValueOnce(broken);
      fireEvent.click(screen.getByText('fileAnalysis.run'));
    }
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(state.close).toHaveBeenCalledTimes(1);
    expect(state.success).not.toHaveBeenCalled();
    expect(view.container.textContent).not.toContain('parsing.csv');
  });

  it('isolates a late previous engine from a newly mounted engine and terminates each once', async () => {
    let resolve: () => void;
    state.instantiate.mockImplementationOnce(() => new Promise<void>(done => (resolve = done)));
    const previous = render(<FileAnalysis />);
    await waitFor(() => expect(state.instantiate).toHaveBeenCalledTimes(1));
    previous.unmount();
    const current = await mountReady();
    expect(state.instantiate).toHaveBeenCalledTimes(2);
    expect(state.terminate).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(state.terminate).toHaveBeenCalledTimes(1);
    expect((screen.getByText('fileAnalysis.selectFile') as HTMLButtonElement).disabled).toBe(false);
    current.unmount();
    expect(state.terminate).toHaveBeenCalledTimes(2);
    expect(state.workerTerminate).not.toHaveBeenCalled();
    expect(state.error).not.toHaveBeenCalled();
  });

  it('terminates a late engine once after unmount', async () => {
    let resolve: () => void;
    state.instantiate.mockImplementation(() => new Promise<void>(done => (resolve = done)));
    const view = render(<FileAnalysis />);
    await waitFor(() => expect(state.instantiate).toHaveBeenCalled());
    view.unmount();
    await act(async () => resolve());
    expect(state.terminate).toHaveBeenCalledTimes(1);
    expect(state.error).not.toHaveBeenCalled();
  });

  it('cleans up a native worker after failed bootstrap without showing errors after unmount', async () => {
    let reject: (error: Error) => void;
    state.instantiate.mockImplementation(() => new Promise<void>((_, fail) => (reject = fail)));
    const view = render(<FileAnalysis />);
    await waitFor(() => expect(state.instantiate).toHaveBeenCalled());
    view.unmount();
    await act(async () => reject(new Error('bootstrap failed')));
    expect(state.workerTerminate).toHaveBeenCalledTimes(1);
    expect(state.error).not.toHaveBeenCalled();
    expect(state.terminate).not.toHaveBeenCalled();
  });
});
