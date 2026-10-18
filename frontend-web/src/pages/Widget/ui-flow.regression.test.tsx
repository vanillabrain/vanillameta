import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WidgetCreate from './WidgetCreate';
import WidgetAttributeSelect from './WidgetCreate/WidgetAttributeSelect';
import WidgetModify from './WidgetModify';
import WidgetView from './WidgetView';
import DashboardView from '@/pages/Dashboard/DashboardView';
import DataLayout from '@/pages/Data/DataLayout';
import { setToken } from '@/helpers/authHelper';
import PageTitleBox from '@/components/PageTitleBox';
import { LoadingContext } from '@/contexts/LoadingContext';
import { LayoutContext } from '@/contexts/LayoutContext';
import { AuthContext } from '@/contexts/AuthContext';

const mocks = vi.hoisted(() => ({
  selectComponents: vi.fn(),
  createWidget: vi.fn(),
  updateWidget: vi.fn(),
  selectWidget: vi.fn(),
  deleteWidget: vi.fn(),
  selectDashboard: vi.fn(),
  selectDatabaseList: vi.fn(),
  selectDatabase: vi.fn(),
  selectData: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn(),
  saved: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  params: { widgetId: '1', dashboardId: '1' },
  setting: null as any,
  grid: null as any,
}));

vi.mock('@/components/button/ConfirmCancelButton', () => ({
  ConfirmButton: () => (
    <button form="widgetAttribute" type="submit">
      Save
    </button>
  ),
}));
vi.mock('@/components/button/ReloadButton', () => ({ default: () => null }));
vi.mock('@/components/button/ModifyButton', () => ({ default: () => null }));
vi.mock('@/components/button/DeleteButton', () => ({
  default: ({ onClick }: any) => <button onClick={onClick}>Delete widget</button>,
}));
vi.mock('@/components/button/AddButton', () => ({ default: () => null }));
vi.mock('@/api/componentService', () => ({ default: { selectComponentList: mocks.selectComponents } }));
vi.mock('@/api/widgetService', () => ({
  default: {
    createWidget: mocks.createWidget,
    updateWidget: mocks.updateWidget,
    selectWidget: mocks.selectWidget,
    deleteWidget: mocks.deleteWidget,
  },
}));
vi.mock('@/api/dashboardService', () => ({ default: { selectDashboard: mocks.selectDashboard } }));
vi.mock('@/api/databaseService', () => ({
  default: {
    selectDatabaseList: mocks.selectDatabaseList,
    selectDatabase: mocks.selectDatabase,
    selectData: mocks.selectData,
  },
}));
vi.mock('@/api/datasetService', () => ({ default: {} }));
vi.mock('@/api/aiService', () => ({ default: {} }));
vi.mock('@/api/shareService', () => ({ default: {} }));
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext(null) };
});
vi.mock('@/contexts/AlertContext', () => ({ SnackbarContext: 'snackbar' }));
vi.mock('react-alert', () => ({
  useAlert: (context?: string) => ({ error: mocks.error, success: context ? mocks.saved : mocks.confirm }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'widget.steps' ? ['Data', 'Type', 'Settings'] : key),
  }),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  useLocation: () => ({ pathname: '/widget/1', state: null }),
  useSearchParams: () => [new URLSearchParams('id=1')],
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock('./WidgetCreate/WidgetDataSelect', () => ({
  default: ({ setDataSet }: any) => (
    <>
      <button onClick={() => setDataSet({ id: 2, databaseId: 1, datasetType: 'DATASET' })}>Source A</button>
      <button onClick={() => setDataSet({ id: 3, databaseId: 1, datasetType: 'DATASET' })}>Source B</button>
    </>
  ),
}));
vi.mock('./WidgetCreate/WidgetTypeSelect', () => ({
  default: ({ setWidgetType }: any) => (
    <>
      <button onClick={() => setWidgetType({ id: 5, title: 'Chart', componentType: 'BAR', option: { axis: 'a' } })}>
        Chart A
      </button>
      <button onClick={() => setWidgetType({ id: 6, title: 'Other', componentType: 'PIE', option: { axis: 'b' } })}>
        Chart B
      </button>
    </>
  ),
}));
vi.mock('@/widget/wrapper/WidgetSetting', () => ({
  default: (props: any) => {
    mocks.setting = props;
    return (
      <>
        <input aria-label="Title" value={props.title} onChange={event => props.setTitle(event.target.value)} />
        <button type="button" onClick={() => props.setWidgetOption({ axis: 'edited' })}>
          Edit option
        </button>
        <button type="submit">Submit widget</button>
      </>
    );
  },
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div data-testid="viewer" /> }));
vi.mock('@/widget/wrapper/WidgetWrapper', () => ({
  default: ({ widgetOption }: any) => <div data-testid="widget-wrapper">{widgetOption.title}</div>,
}));
vi.mock('@/components/PageViewBox', () => ({
  default: ({ children, title, button }: any) => (
    <section>
      <h2>{title}</h2>
      {button}
      {children}
    </section>
  ),
}));
// These DashboardView cases isolate dashboardService/grid error handling. Scope loading and
// fail-closed behavior belong to DashboardAnalysis.test.tsx; never rely on an unmocked HTTP
// failure making its children render as if the saved scope had been verified.
vi.mock('@/pages/Dashboard/Components/DashboardAnalysis', () => ({
  default: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/components/button/ShareButton', () => ({ default: () => null }));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('react-grid-layout', () => ({
  Responsive: ({ children }: any) => <div data-testid="dashboard-grid">{children}</div>,
  WidthProvider: (component: any) => component,
}));
vi.mock('@/components/list/DatabaseCardList', () => ({
  DatabaseCardList: ({ data, handleDataClick }: any) => (
    <div>
      {data.map((item: any) => (
        <button key={item.id} onClick={() => handleDataClick(item)}>
          {item.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/list/DatasetCardList', () => ({
  DatasetCardList: ({ data, handleDataClick }: any) => (
    <div>
      {data.map((item: any) => (
        <button key={item.id} onClick={() => handleDataClick(item)}>
          {item.title || item.tableName}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/ModalPopup', () => ({ default: ({ open, children }: any) => (open ? <div>{children}</div> : null) }));
vi.mock('@/components/loading', () => ({ Loading: () => <div>Loading</div> }));
vi.mock('@/components/datagrid', () => ({
  default: (props: any) => {
    mocks.grid = props;
    return <div data-testid="data-grid" />;
  },
  DataGridWrapper: ({ children }: any) => <div>{children}</div>,
}));

const response = (data: any, status = 'SUCCESS') => ({ status: 200, data: { status, data } });
const widget = (id = 1) => ({
  id,
  datasetType: 'DATASET',
  datasetId: 2,
  title: `Widget ${id}`,
  option: { axis: 'a' },
  componentType: 'BAR',
});
const selectedData = { id: 2, databaseId: 1, datasetType: 'DATASET' };
const chart = { id: 5, title: 'Chart', componentType: 'BAR', option: { axis: 'a' } };
let client: QueryClient;

function Providers({ children }: any) {
  return (
    <QueryClientProvider client={client}>
      <LoadingContext.Provider value={{ loading: false, showLoading: mocks.show, hideLoading: mocks.hide }}>
        <LayoutContext.Provider value={{ fixed: false, fixLayout: vi.fn(), footerBg: null, changeFooterBg: vi.fn() }}>
          <AuthContext.Provider value={{ userState: { userId: 'tester' } }}>{children}</AuthContext.Provider>
        </LayoutContext.Provider>
      </LoadingContext.Provider>
    </QueryClientProvider>
  );
}

function mount(element: React.ReactElement) {
  return render(element, { wrapper: Providers });
}

function goToSettings() {
  fireEvent.click(screen.getByText('Source A'));
  fireEvent.click(screen.getByText('widget.next'));
  fireEvent.click(screen.getByText('Chart A'));
  fireEvent.click(screen.getByText('widget.next'));
}

async function confirmSave() {
  fireEvent.click(screen.getByText('Submit widget'));
  await act(async () => {
    await mocks.confirm.mock.calls.at(-1)[1].actions[0].onClick();
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setToken('widget-regression-session');
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.params = { widgetId: '1', dashboardId: '1' };
  mocks.setting = null;
  mocks.grid = null;
  mocks.selectComponents.mockResolvedValue({ data: [chart] });
  mocks.selectData.mockResolvedValue(response({ datas: [{ amount: 10 }], fields: [{ columnName: 'amount' }] }));
  mocks.selectWidget.mockResolvedValue(response(widget()));
  mocks.createWidget.mockResolvedValue(response(widget()));
  mocks.updateWidget.mockResolvedValue(response(widget()));
  mocks.selectDashboard.mockResolvedValue(
    response({ title: 'Dashboard', widgets: [widget()], layout: [{ i: 1, w: 3 }], shareYn: 'N' }),
  );
  mocks.selectDatabaseList.mockResolvedValue(
    response([
      { id: 1, name: 'Broken' },
      { id: 2, name: 'Healthy' },
    ]),
  );
  mocks.selectDatabase.mockResolvedValue(response({ datasets: [], tables: [] }));
});

afterEach(() => {
  cleanup();
  client.clear();
});

describe('widget wizard state and saving', () => {
  it('retains source and chart selection after Back without writing', async () => {
    mount(<WidgetCreate />);
    goToSettings();
    fireEvent.click(screen.getByText('widget.prev'));
    expect((screen.getByText('widget.next') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('widget.prev'));
    expect((screen.getByText('widget.next') as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.createWidget).not.toHaveBeenCalled();
  });

  it('retains title and options on step return, resetting only on actual source or type changes', async () => {
    mount(<WidgetCreate />);
    goToSettings();
    await screen.findByLabelText('Title');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My draft' } });
    fireEvent.click(screen.getByText('Edit option'));
    fireEvent.click(screen.getByText('widget.prev'));
    fireEvent.click(screen.getByText('Chart A'));
    fireEvent.click(screen.getByText('widget.next'));
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My draft');
    expect(mocks.setting.widgetOption).toEqual({ axis: 'edited' });
    fireEvent.click(screen.getByText('widget.prev'));
    fireEvent.click(screen.getByText('Chart B'));
    fireEvent.click(screen.getByText('widget.next'));
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Other');
    fireEvent.click(screen.getByText('widget.prev'));
    fireEvent.click(screen.getByText('widget.prev'));
    fireEvent.click(screen.getByText('Source A'));
    fireEvent.click(screen.getByText('widget.next'));
    expect((screen.getByText('widget.next') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('widget.prev'));
    fireEvent.click(screen.getByText('Source B'));
    fireEvent.click(screen.getByText('widget.next'));
    expect((screen.getByText('widget.next') as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.createWidget).not.toHaveBeenCalled();
  });

  it.each(['semantic', 'transport'])('create %s error never shows Saved or navigates and keeps edits', async kind => {
    if (kind === 'semantic') mocks.createWidget.mockResolvedValue({ data: { status: 'ERROR', message: 'Save rejected' } });
    else mocks.createWidget.mockRejectedValue(new Error('Save rejected'));
    mount(<WidgetCreate />);
    goToSettings();
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Unsaved edit' } });
    fireEvent.click(screen.getByText('Edit option'));
    await confirmSave();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Save rejected'));
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Unsaved edit');
    expect(mocks.setting.widgetOption).toEqual({ axis: 'edited' });
    expect(mocks.hide).toHaveBeenCalled();
  });

  it('shows Saved only after successful save completes', async () => {
    let finish: (value: any) => void;
    mocks.createWidget.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    mount(<WidgetCreate />);
    goToSettings();
    fireEvent.click(await screen.findByText('Submit widget'));
    let saving: Promise<any>;
    act(() => {
      saving = mocks.confirm.mock.calls.at(-1)[1].actions[0].onClick();
    });
    expect(mocks.saved).not.toHaveBeenCalled();
    await act(async () => {
      finish(response(widget()));
      await saving;
    });
    expect(mocks.saved).toHaveBeenCalledWith('widgetCreate.saved');
    expect(mocks.navigate).toHaveBeenCalledWith('/widget');
  });

  it.each(['semantic', 'transport'])('modify %s error is caught and never shows Saved', async kind => {
    if (kind === 'semantic') mocks.updateWidget.mockResolvedValue({ data: { status: 'ERROR', message: 'Update rejected' } });
    else mocks.updateWidget.mockRejectedValue(new Error('Update rejected'));
    mount(<WidgetModify />);
    await screen.findByLabelText('Title');
    await waitFor(() => expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Widget 1'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved modification' } });
    fireEvent.click(screen.getByText('Edit option'));
    await confirmSave();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Update rejected'));
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Unsaved modification');
    expect(mocks.setting.widgetOption).toEqual({ axis: 'edited' });
  });
});

describe('widget loading', () => {
  it('catches widget deletion transport failures without reporting success', async () => {
    mocks.deleteWidget.mockRejectedValueOnce(new Error('HTTP 404'));
    mount(<WidgetView />);
    await screen.findByTestId('widget-wrapper');
    fireEvent.click(screen.getByText('Delete widget'));
    await act(async () => {
      mocks.confirm.mock.calls.at(-1)[1].actions[0].onClick();
      await Promise.resolve();
    });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('widget.deleteFailed'));
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.hide).toHaveBeenCalled();
  });

  it('waits for the modify widget response before fetching its data', async () => {
    let finish: (value: any) => void;
    mocks.selectWidget.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    mount(<WidgetModify />);
    await waitFor(() => expect(mocks.selectWidget).toHaveBeenCalledWith('1'));
    expect(mocks.selectData).not.toHaveBeenCalled();
    expect(screen.queryByTestId('viewer')).toBeNull();
    await act(async () => {
      finish(response(widget()));
    });
    await waitFor(() => expect(mocks.selectData).toHaveBeenCalledTimes(1));
    expect(mocks.selectData.mock.calls[0][0]).toMatchObject({ datasetId: 2, datasetType: 'DATASET', id: 1 });
  });

  it('does not fetch incomplete, zero or missing widget identifiers', async () => {
    const { rerender } = mount(
      <WidgetAttributeSelect
        isModifyMode
        widgetOption={{ ...chart, datasetType: 'DATASET', datasetId: 2, id: '' }}
        saveWidgetInfo={async () => false}
      />,
    );
    rerender(
      <WidgetAttributeSelect
        isModifyMode
        widgetOption={{ ...chart, datasetType: 'DATASET', datasetId: 0 }}
        saveWidgetInfo={async () => false}
      />,
    );
    rerender(
      <WidgetAttributeSelect
        isModifyMode
        widgetOption={{ ...chart, datasetType: 'TABLE', databaseId: 1, tableName: '' }}
        saveWidgetInfo={async () => false}
      />,
    );
    await act(async () => Promise.resolve());
    expect(mocks.selectData).not.toHaveBeenCalled();
  });

  it('does not fetch default modify parameters or parse missing options', async () => {
    mount(
      <WidgetAttributeSelect
        isModifyMode
        widgetOption={{ id: '', datasetId: '', datasetType: '' }}
        saveWidgetInfo={async () => false}
      />,
    );
    await act(async () => Promise.resolve());
    expect(mocks.selectData).not.toHaveBeenCalled();
    expect(screen.queryByTestId('viewer')).toBeNull();
  });

  it.each([
    { id: 7, datasetType: 'DATASET', datasetId: 2 },
    { id: 7, datasetType: 'TABLE', databaseId: 1, tableName: 'sales' },
  ])('fetches only a loaded valid modify selection %j', async source => {
    const { rerender } = mount(<WidgetAttributeSelect isModifyMode widgetOption={{}} saveWidgetInfo={async () => false} />);
    expect(mocks.selectData).not.toHaveBeenCalled();
    rerender(
      <WidgetAttributeSelect isModifyMode widgetOption={{ ...chart, ...source }} saveWidgetInfo={async () => false} />,
    );
    await waitFor(() => expect(mocks.selectData).toHaveBeenCalledTimes(1));
    expect(mocks.selectData.mock.calls[0][0]).toMatchObject(source);
  });

  it('catches data transport errors and clears previous preview data on selection changes', async () => {
    const { rerender } = mount(
      <WidgetAttributeSelect dataset={selectedData} widgetOption={chart} saveWidgetInfo={async () => false} />,
    );
    await waitFor(() => expect(mocks.setting.dataSet).toEqual([{ amount: 10 }]));
    mocks.selectData.mockRejectedValueOnce(new Error('Source unavailable'));
    rerender(
      <WidgetAttributeSelect dataset={{ ...selectedData, id: 3 }} widgetOption={chart} saveWidgetInfo={async () => false} />,
    );
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.setting.dataSet).toBeNull();
    expect(mocks.setting.spec).toBeNull();
    expect(mocks.hide).toHaveBeenCalled();
  });

  it('shows controlled missing saved-option placeholder', async () => {
    mount(
      <WidgetAttributeSelect
        isModifyMode
        widgetOption={{ ...widget(), option: undefined }}
        saveWidgetInfo={async () => false}
      />,
    );
    expect(await screen.findByText('share.widgetFetchFailed')).toBeTruthy();
    expect(screen.queryByTestId('viewer')).toBeNull();
  });

  it.each(['semantic', 'transport'])(
    'widget view %s error keeps page visible without wrapper and recovers on next id',
    async kind => {
      if (kind === 'semantic') mocks.selectWidget.mockResolvedValueOnce({ data: { status: 'ERROR' } });
      else mocks.selectWidget.mockRejectedValueOnce(new Error('HTTP 404'));
      const { rerender } = mount(<WidgetView />);
      expect(await screen.findByText('share.widgetFetchFailed')).toBeTruthy();
      expect(screen.getByText('widget.view')).toBeTruthy();
      expect(screen.queryByTestId('widget-wrapper')).toBeNull();
      expect(mocks.hide).toHaveBeenCalled();
      mocks.params.widgetId = '2';
      mocks.selectWidget.mockResolvedValueOnce(response(widget(2)));
      rerender(<WidgetView />);
      expect(await screen.findByTestId('widget-wrapper')).toBeTruthy();
      expect(screen.queryByText('share.widgetFetchFailed')).toBeNull();
    },
  );
});

describe('dashboard and database errors', () => {
  it('dashboard HTTP 404 clears the previous widget grid, catches failure and hides loading', async () => {
    const { rerender } = mount(<DashboardView />);
    await screen.findByTestId('widget-wrapper');
    mocks.selectDashboard.mockRejectedValueOnce(new Error('HTTP 404'));
    mocks.params.dashboardId = '2';
    mocks.hide.mockClear();
    rerender(<DashboardView />);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('dashboard.loadFailed'));
    expect(screen.queryByTestId('widget-wrapper')).toBeNull();
    expect(mocks.hide).toHaveBeenCalled();
    expect(screen.getByTestId('dashboard-grid').children.length).toBe(0);
  });

  it('dashboard malformed arrays cannot blank the page', async () => {
    mocks.selectDashboard.mockResolvedValueOnce(response({ title: 'Malformed', layout: null, widgets: null }));
    mount(<DashboardView />);
    await waitFor(() => expect(mocks.hide).toHaveBeenCalled());
    expect(screen.getByTestId('dashboard-grid')).toBeTruthy();
    expect(screen.queryByTestId('widget-wrapper')).toBeNull();
  });

  it('corrupt database HTTP 400 shows an error while a healthy selection recovers', async () => {
    mocks.selectDatabase.mockRejectedValueOnce(new Error('Corrupt configuration'));
    mocks.selectDatabase.mockResolvedValue(
      response({ datasets: [{ id: 3, databaseId: 2, datasetType: 'DATASET', title: 'Healthy dataset' }], tables: [] }),
    );
    mount(<DataLayout isViewMode={false} />);
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByText('data.source')).toBeTruthy();
    fireEvent.click(screen.getByText('Healthy'));
    expect(await screen.findByText('Healthy dataset')).toBeTruthy();
    expect(mocks.selectDatabase).toHaveBeenCalledWith(2);
  });

  it.each(['semantic', 'transport'])('data preview %s errors clear rows and show a localized error', async kind => {
    mocks.selectDatabase.mockResolvedValue(response({ datasets: [{ ...selectedData, title: 'Dataset' }], tables: [] }));
    if (kind === 'semantic')
      mocks.selectData.mockResolvedValueOnce({ data: { status: 'ERROR', message: 'Preview rejected' } });
    else mocks.selectData.mockRejectedValueOnce(new Error('Preview rejected'));
    mount(<DataLayout isViewMode={false} />);
    fireEvent.click(await screen.findByText('Dataset'));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.grid.data).toEqual([]);
    expect(mocks.grid.columns).toEqual([]);
    expect(mocks.hide).toHaveBeenCalled();
  });

  it('intentional cancelled database query does not show an error alert', async () => {
    mocks.selectDatabase.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { code: 'ERR_CANCELED' }));
    mount(<DataLayout isViewMode={false} />);
    await waitFor(() => expect(mocks.selectDatabase).toHaveBeenCalled());
    await act(async () => Promise.resolve());
    expect(mocks.error).not.toHaveBeenCalled();
  });
});

it('keeps a single clickable page action in the mobile header without xs display:none', () => {
  const onClick = vi.fn();
  mount(
    <PageTitleBox title="Metrics" button={<button onClick={onClick}>Add metric</button>}>
      <div>Metric body</div>
    </PageTitleBox>,
  );
  const button = screen.getByRole('button', { name: 'Add metric' });
  expect(screen.getAllByRole('button', { name: 'Add metric' }).length).toBe(1);
  // The action stays reachable at narrow widths: no ancestor may be hidden at the smallest breakpoint.
  const hidesAtSmallWidth = /(?:^|\s)(?:hidden|max-(?:xs|sm|md|lg|xl):hidden)(?:\s|$)/;
  const hiddenAncestors: string[] = [];
  for (let node: HTMLElement | null = button; node && node !== document.body; node = node.parentElement) {
    const className = node.getAttribute('class') ?? '';
    if (hidesAtSmallWidth.test(className)) hiddenAncestors.push(className);
  }
  expect(hiddenAncestors).toEqual([]);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
