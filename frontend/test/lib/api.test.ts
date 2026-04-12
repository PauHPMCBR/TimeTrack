import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../lib/api';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const mockFetchSuccess = (data: any) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    }) as any;
  };

  const mockFetchError = (status: number, error: string) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error }),
    }) as any;
  };

  describe('login', () => {
    it('should return data on successful login', async () => {
      const mockResponse = {
        data: {
          token: 'test-token',
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
        },
      };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.login({ email: 'test@example.com', password: 'password123' });

      expect(result.data).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        })
      );
    });

    it('should return error on failed login', async () => {
      mockFetchError(401, 'InvalidCredentials');

      const result = await apiClient.login({ email: 'test@example.com', password: 'wrong' });

      expect(result.error).toBe('InvalidCredentials');
    });
  });

  describe('register', () => {
    it('should return data on successful registration', async () => {
      const mockResponse = {
        data: {
          token: 'test-token',
          user: { id: '1', email: 'new@example.com', name: 'New User' },
        },
      };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.register({
        registrationToken: 'abc123',
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getProfile', () => {
    it('should fetch current user profile', async () => {
      const mockResponse = { data: { user: { id: '1', name: 'Test' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getProfile();

      expect(result.data).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profile/me'),
        expect.any(Object)
      );
    });

    it('should fetch specific user profile', async () => {
      const mockResponse = { data: { user: { id: '2', name: 'Other' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getProfile('2');

      expect(result.data).toEqual(mockResponse.data);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profile/2'),
        expect.any(Object)
      );
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const mockResponse = { data: { user: { id: '3', name: 'Created' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.createUser({ name: 'Created', email: 'created@example.com' });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getGroupInfo', () => {
    it('should fetch group info', async () => {
      const mockResponse = { data: { group: { id: 'g1', name: 'Team' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getGroupInfo('g1');

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getUserGroups', () => {
    it('should fetch user groups', async () => {
      const mockResponse = { data: { groups: [{ id: 'g1' }, { id: 'g2' }] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getUserGroups('u1');

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('createGroup', () => {
    it('should create a new group', async () => {
      const mockResponse = { data: { group: { id: 'g3', name: 'New Group' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.createGroup({ name: 'New Group' });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('logoff', () => {
    it('should clear localStorage and reset currentUser', async () => {
      localStorage.setItem('auth_token', 'token');
      localStorage.setItem('remembered_email', 'test@example.com');

      await apiClient.logoff();

      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('remembered_email')).toBeNull();
    });
  });

  describe('getWorkSessionReasons', () => {
    it('should fetch work session reasons', async () => {
      const mockResponse = {
        data: { reasons: [{ id: 'r1', type: 'check_in', englishText: 'Working from home' }] },
      };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getWorkSessionReasons();

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('addWorkRecordTimestamp', () => {
    it('should add work record timestamp', async () => {
      const mockResponse = { data: { workSession: { id: 'ws1', type: 'check_in' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.addWorkRecordTimestamp({ type: 'check_in' });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getMonthlyRecords', () => {
    it('should fetch monthly records', async () => {
      const mockResponse = { data: { sessions: [], totalHours: 0 } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getMonthlyRecords('u1', 6, 2024);

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('error handling', () => {
    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await apiClient.login({ email: 'test@example.com', password: 'password' });

      expect(result.error).toBe('NetworkError');
    });
  });

  describe('getCurrentlyWorking', () => {
    it('should fetch currently working users', async () => {
      const mockResponse = { data: { count: 3, users: [{ id: '1' }, { id: '2' }, { id: '3' }] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getCurrentlyWorking();

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getAllGroups', () => {
    it('should fetch all groups', async () => {
      const mockResponse = { data: { groups: [{ id: 'g1' }, { id: 'g2' }] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getAllGroups();

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('updateGroup', () => {
    it('should update a group', async () => {
      const mockResponse = { data: { group: { id: 'g1', name: 'Updated' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.updateGroup('g1', { name: 'Updated' });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group', async () => {
      const mockResponse = { data: {} };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.deleteGroup('g1');

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getAllVacationsYearAdmin', () => {
    it('should fetch all vacations for a year', async () => {
      const mockResponse = { data: { year: 2024, obligatoryDays: [], electiveDaysTotalCount: 22 } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getAllVacationsYearAdmin(2024);

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getAllPendingVacations', () => {
    it('should fetch all pending vacations', async () => {
      const mockResponse = { data: { vacations: [{ id: 'v1', status: 'pending' }] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getAllPendingVacations();

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('resolveVacation', () => {
    it('should resolve a vacation', async () => {
      const mockResponse = { data: { success: true } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.resolveVacation('v1', 'approved');

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getYearlyVacationsGlobal', () => {
    it('should fetch yearly vacations global', async () => {
      const mockResponse = { data: { vacations: { year: 2024 } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getYearlyVacationsGlobal(2024);

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('setYearlyVacationsAdmin', () => {
    it('should set yearly vacations', async () => {
      const mockResponse = { data: { success: true } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.setYearlyVacationsAdmin({
        year: 2024,
        obligatoryDays: ['2024-01-01'],
        electiveDaysTotalCount: 22,
      });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('createVacation', () => {
    it('should create a vacation', async () => {
      const mockResponse = { data: { vacation: { id: 'v1', date: '2024-06-15' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.createVacation({ date: '2024-06-15', reason: 'Family' });

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('cancelVacation', () => {
    it('should cancel a vacation', async () => {
      const mockResponse = { data: { success: true } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.cancelVacation('v1');

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getUserVacations', () => {
    it('should fetch user vacations', async () => {
      const mockResponse = { data: { year: 2024, selectedElectiveDays: [] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getUserVacations('u1', 2024);

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getTeamVacations', () => {
    it('should fetch team vacations', async () => {
      const mockResponse = { data: { vacations: [] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getTeamVacations(2024);

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getDailyRecords', () => {
    it('should fetch daily records', async () => {
      const mockResponse = { data: { workSessions: [{ id: 'ws1' }] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getDailyRecords('u1', new Date('2024-06-15'));

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getCompanyUsers', () => {
    it('should fetch all company users', async () => {
      const mockResponse = { data: { users: [{ id: 'u1' }, { id: 'u2' }] } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getCompanyUsers();

      expect(result.data).toEqual(mockResponse.data);
    });
  });

  describe('getCurrentUser', () => {
    it('should return cached current user', async () => {
      const mockResponse = { data: { user: { id: '1', name: 'Test' } } };
      mockFetchSuccess(mockResponse);

      const result = await apiClient.getCurrentUser();

      expect(result).toEqual(mockResponse.data.user);
    });
  });

  describe('setErrorListener', () => {
    it('should set and call error listener on error', async () => {
      const mockError = 'TestError';
      const listener = vi.fn();

      mockFetchError(500, mockError);
      apiClient.setErrorListener(listener);

      await apiClient.login({ email: 'test@example.com', password: 'wrong' });

      expect(listener).toHaveBeenCalledWith(mockError, expect.objectContaining({ error: mockError }));
    });
  });

  describe('authorization header', () => {
    it('should include authorization token in request', async () => {
      const mockResponse = { data: { user: { id: '1' } } };
      mockFetchSuccess(mockResponse);
      localStorage.setItem('auth_token', 'token123');

      await apiClient.getProfile();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        })
      );
    });
  });
});
