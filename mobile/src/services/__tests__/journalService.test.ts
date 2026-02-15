/**
 * Unit tests for journalService — auth token behavior and API vs mock priming.
 */

import { journalService } from '../journalService';
import * as client from '@/api/client';

const mockGetAuthToken = client.getAuthToken as jest.Mock;
const mockSetAuthToken = client.setAuthToken as jest.Mock;
const mockApiGet = client.api.get as jest.Mock;

jest.mock('@/api/client', () => ({
  getAuthToken: jest.fn(),
  setAuthToken: jest.fn(),
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('journalService', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  describe('auth token behavior', () => {
    it('returns mock priming and does not call API when no auth token', async () => {
      mockGetAuthToken.mockReturnValue(null);

      const result = await journalService.getPrimingText();

      expect(mockGetAuthToken).toHaveBeenCalled();
      expect(mockApiGet).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '[journalService] No auth token; using mock priming. Sign in to get calendar summary.'
      );
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/^•/m);
    });

    it('calls API and returns summary when auth token is set and API succeeds', async () => {
      mockGetAuthToken.mockReturnValue('valid-token-123');
      const summary = '• Team standup\n• Lunch with Sarah\n• Shipped feature X';
      mockApiGet.mockResolvedValue({ ok: true, summary });

      const result = await journalService.getPrimingText();

      expect(mockGetAuthToken).toHaveBeenCalled();
      expect(mockApiGet).toHaveBeenCalledWith('/summarize', expect.any(Object));
      expect(mockApiGet.mock.calls[0][1].params).toMatchObject({
        hours: expect.any(String),
        includeGmail: 'true',
      });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(result).toBe(summary);
    });

    it('uses auth token from getAuthToken (set via setAuthToken)', async () => {
      mockSetAuthToken('my-bearer-token');
      mockGetAuthToken.mockReturnValue('my-bearer-token');
      mockApiGet.mockResolvedValue({ ok: true, summary: '• Did things' });

      await journalService.getPrimingText();

      expect(mockGetAuthToken).toHaveBeenCalled();
      expect(mockApiGet).toHaveBeenCalled();
    });

    it('when auth token is set but API returns error, falls back to mock and warns', async () => {
      mockGetAuthToken.mockReturnValue('token');
      mockApiGet.mockResolvedValue({ ok: false, error: 'Calendar unavailable' });

      const result = await journalService.getPrimingText();

      expect(mockApiGet).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[journalService] GET /summarize failed'),
        'Calendar unavailable'
      );
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^•/m);
    });

    it('when auth token is set but API returns empty summary, falls back to mock', async () => {
      mockGetAuthToken.mockReturnValue('token');
      mockApiGet.mockResolvedValue({ ok: true, summary: '' });

      const result = await journalService.getPrimingText();

      expect(mockApiGet).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[journalService] GET /summarize failed'),
        'Empty summary'
      );
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^•/m);
    });

    it('when auth token is set but API throws, falls back to mock', async () => {
      mockGetAuthToken.mockReturnValue('token');
      mockApiGet.mockRejectedValue(new Error('Network error'));

      const result = await journalService.getPrimingText();

      expect(mockApiGet).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[journalService] GET /summarize failed'),
        'Network error'
      );
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^•/m);
    });

    it('when auth token is set, passes includeGmail option to API', async () => {
      mockGetAuthToken.mockReturnValue('token');
      mockApiGet.mockResolvedValue({ ok: true, summary: '• Done' });

      await journalService.getPrimingText(undefined, { includeGmail: false });

      expect(mockApiGet).toHaveBeenCalledWith('/summarize', {
        params: expect.objectContaining({ includeGmail: 'false' }),
      });
    });
  });
});
