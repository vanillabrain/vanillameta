import { ServiceUnavailableException } from '@nestjs/common';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
export const SHEETS_MAX_CELLS = 100000;

export class GoogleSheetsProvider {
  private config() {
    const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI;
    try {
      const uri = new URL(redirectUri ?? '');
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname);
      if (!clientId || !clientSecret) throw new Error('missing');
      if (
        (uri.protocol !== 'https:' &&
          !(process.env.NODE_ENV !== 'prod' && loopback && uri.protocol === 'http:')) ||
        !uri.pathname.endsWith('/documents/sheets/callback') ||
        uri.search ||
        uri.hash ||
        uri.username ||
        uri.password
      )
        throw new Error('callback');
      return { clientId, clientSecret, redirectUri: uri.toString() };
    } catch {
      throw new ServiceUnavailableException(
        '관리자가 Google Sheets 데이터 연결 설정을 완료해야 합니다.',
      );
    }
  }
  configured(): boolean {
    try {
      this.config();
      return true;
    } catch {
      return false;
    }
  }
  authorizationUrl(input: { state: string; verifier: string }) {
    const { clientId, redirectUri } = this.config();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SHEETS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: input.state,
      code_challenge: input.verifier,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }
  async values(
    accessToken: string,
    spreadsheetId: string,
    range: string,
    fetcher: typeof fetch = fetch,
  ) {
    const url =
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(spreadsheetId) +
      '/values/' +
      encodeURIComponent(range) +
      '?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS';
    const response = await fetcher(url, { headers: { authorization: 'Bearer ' + accessToken } });
    if (!response.ok) throw new ServiceUnavailableException('Sheets 값을 읽지 못했습니다.');
    const body = (await response.json()) as { values?: unknown[][] };
    const rows = (body.values ?? []).map(row =>
      row.map(cell => (cell === null || cell === undefined ? '' : String(cell))),
    );
    const cells = rows.reduce((total, row) => total + row.length, 0);
    if (cells > SHEETS_MAX_CELLS)
      throw new ServiceUnavailableException('시트 범위가 100,000셀을 넘습니다.');
    return rows;
  }
}
export function toCsv(rows: string[][]): string {
  return rows
    .map(row =>
      row
        .map(cell => (/[",\n\r]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell))
        .join(','),
    )
    .join('\n');
}
