import type {
    AdminReplaceDayWorkSessionsRequest,
    AdminWorkSessionsQueryWithPagination,
    AdminWorkSessionInput,
    AppSettingsRequest,
    ApplyAutoScheduleRequest,
    CreateGroupRequest,
    CreateUserRequest,
    ElectiveVacationRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MonthlyWorkRecordResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UpdateUserRequest,
    UserLoginResponse,
    WorkSessionAnomaly,
    WorkSessionRequest,
    YearlyVacationAdminRequest,
    YearlyVacationResponse,
} from '@/schemas/api';
import {
    AdminWorkSessionsResponse,
    AdminDashboardResponse,
    AppSettings,
    ElectiveVacation,
    Group,
    GroupMember,
    TeamVacation,
    User,
    WorkSession,
    WorksessionReason,
    YearlyVacationDays,
} from '@/types';
import { ApiResponse, ErrorDetails } from '@/types/apiErrors';
import type { ErrorCode } from 'shared/src/types/response-errors';
import {
    REFRESH_TOKEN_HEADER,
    VACATION_APPROVED,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { AUTH_TOKEN_KEY, REMEMBERED_EMAIL_KEY } from './storage';
import { triggerDownload } from './csv';
import { toLocalDateKey } from './datetime';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

class ApiClient {
    private currentUser: User | undefined = undefined;
    private errorListener: ((error: string, details?: unknown) => void) | null =
        null;
    private reasonsPromise: Promise<
        ApiResponse<{ reasons: WorksessionReason[] }>
    > | null = null;
    private avatarCache = new Map<string, Promise<Blob | null>>();
    // Session token kept in memory so a non-"remembered" login still works for
    // the current tab; persisted to localStorage only when the user asks.
    private token: string | null = null;
    // Defaults to true: a session restored from localStorage is a remembered one,
    // so refreshed tokens keep being persisted.
    private persistToken = true;

    setErrorListener(
        listener: ((error: string, details?: unknown) => void) | null
    ) {
        this.errorListener = listener;
    }

    /** Registers a new session token. `persist` controls localStorage storage. */
    setSession(token: string, persist: boolean) {
        this.token = token;
        this.persistToken = persist;
        if (persist) {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        }
    }

    private getSessionToken(): string | null {
        return this.token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const token = this.getSessionToken();

        const config: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
                ...options.headers,
            },
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

            // Sliding session: the backend re-issues the JWT (96h) in this header
            // when it's close to expiring. Keep it in memory; persist only when
            // the session was set up to be remembered.
            const refreshedToken = response.headers.get(REFRESH_TOKEN_HEADER);
            if (refreshedToken) {
                this.token = refreshedToken;
                if (this.persistToken) {
                    localStorage.setItem(AUTH_TOKEN_KEY, refreshedToken);
                }
            }

            let data: { error?: string; details?: unknown; data?: unknown };
            try {
                data = await response.json();
            } catch (e) {
                data = { error: 'InvalidJsonResponse' };
            }

            if (!response.ok) {
                const result: ApiResponse<T> = {
                    error: (data.error ||
                        response.statusText ||
                        'Request failed') as ErrorCode,
                    details: (data.details ?? {}) as ErrorDetails,
                };
                if (this.errorListener) {
                    this.errorListener(
                        result.error ?? 'Request failed',
                        result.details
                    );
                }
                return result;
            }

            if (data.data) {
                return { data: data.data as T };
            }

            return { data: data as unknown as T };
        } catch (error) {
            const result: ApiResponse<T> = { error: 'NetworkError' };
            if (this.errorListener && result.error) {
                this.errorListener(result.error);
            }
            return result;
        }
    }

    async getCurrentUser(): Promise<User | undefined> {
        if (this.currentUser === undefined) {
            const prof = await this.getProfile();
            this.currentUser = prof.data?.user;
        }
        return this.currentUser;
    }

    async login(
        credentials: LoginRequest
    ): Promise<ApiResponse<UserLoginResponse>> {
        return await this.request<UserLoginResponse>(`/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    async logoff() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        this.token = null;
        this.persistToken = false;
        this.currentUser = undefined;
        this.reasonsPromise = null;
        this.avatarCache.clear();
    }

    async register(
        credentials: RegisterRequest
    ): Promise<ApiResponse<UserLoginResponse>> {
        return this.request<UserLoginResponse>(`/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    async forgotPassword(
        email: string
    ): Promise<ApiResponse<{ message: string }>> {
        const body: ForgotPasswordRequest = { email };
        return this.request(`/api/auth/forgot-password`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async resetPassword(
        credentials: ResetPasswordRequest
    ): Promise<ApiResponse<UserLoginResponse>> {
        return this.request<UserLoginResponse>(`/api/auth/reset-password`, {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    async updateMyProfile(
        input: UpdateProfileRequest
    ): Promise<ApiResponse<{ user: User }>> {
        const res = await this.request<{ user: User }>(`/api/profile/me`, {
            method: 'PUT',
            body: JSON.stringify(input),
        });
        if (!res.error) {
            // The cached profile is stale after a profile update.
            this.currentUser = undefined;
        }
        return res;
    }

    async applyAutoSchedule(
        input?: ApplyAutoScheduleRequest
    ): Promise<
        ApiResponse<{
            workSessions: WorkSession[];
            totalHours: number;
            anomalies: WorkSessionAnomaly[];
        }>
    > {
        return this.request(`/api/work-sessions/apply-auto-schedule`, {
            method: 'POST',
            body: JSON.stringify(input ?? {}),
        });
    }

    async getGroupInfo(
        groupId: string
    ): Promise<ApiResponse<{ group: Group & { members: GroupMember[] } }>> {
        return this.request(`/api/groups/${groupId}`);
    }

    async getUserGroups(
        userId: string
    ): Promise<ApiResponse<{ groups: Group[] }>> {
        return this.request(`/api/groups/user/${userId}`);
    }

    async getAllGroups(): Promise<ApiResponse<{ groups: Group[] }>> {
        return this.request(`/api/admin/groups`);
    }

    async updateGroup(
        groupId: string,
        newGroupParams: CreateGroupRequest
    ): Promise<ApiResponse<{ group: Group }>> {
        return this.request(`/api/groups/update/${groupId}`, {
            method: 'PUT',
            body: JSON.stringify(newGroupParams),
        });
    }

    async deleteGroup(
        groupId: string
    ): Promise<ApiResponse<Record<string, never>>> {
        return this.request(`/api/groups/update/${groupId}`, {
            method: 'DELETE',
        });
    }

    async createGroup(
        newGroupParams: CreateGroupRequest
    ): Promise<ApiResponse<{ group: Group }>> {
        return this.request(`/api/groups/create`, {
            method: 'POST',
            body: JSON.stringify(newGroupParams),
        });
    }

    async getProfile(userId?: string): Promise<ApiResponse<{ user: User }>> {
        if (userId === undefined) {
            return this.request(`/api/profile/me`);
        }
        return this.request(`/api/profile/${userId}`);
    }

    async uploadAvatar(
        dataUrl: string
    ): Promise<ApiResponse<{ avatar: string }>> {
        const res = await this.request<{ avatar: string }>(
            `/api/profile/avatar`,
            {
                method: 'POST',
                body: JSON.stringify({ dataUrl }),
            }
        );
        if (!res.error) {
            this.currentUser = undefined;
        }
        return res;
    }

    // Avatars are fetched with the auth token (an <img> tag can't send the JWT,
    // and an unauthenticated request would be blocked by the browser), then
    // displayed via a blob URL. The blob is cached per (userId, version) so the
    // network is only hit once per avatar version across the SPA session.
    async getAvatarBlob(
        userId: string,
        version?: string | null
    ): Promise<Blob | null> {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const endpoint = `/api/profile/${userId}/avatar${version ? `?v=${encodeURIComponent(version)}` : ''}`;
        const key = `${userId}:${version ?? ''}`;

        let cached = this.avatarCache.get(key);
        if (!cached) {
            cached = this.fetchAvatarBlob(endpoint, token);
            this.avatarCache.set(key, cached);
        }
        return cached;
    }

    private async fetchAvatarBlob(
        endpoint: string,
        token: string | null
    ): Promise<Blob | null> {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!response.ok) return null;
            return await response.blob();
        } catch {
            return null;
        }
    }

    async createUser(userCreated: CreateUserRequest): Promise<
        ApiResponse<{
            user: User;
            registrationLink?: string;
            registrationToken?: string;
        }>
    > {
        return this.request(`/api/profile/create`, {
            method: 'POST',
            body: JSON.stringify(userCreated),
        });
    }

    async updateUser(
        userId: string,
        params: UpdateUserRequest
    ): Promise<ApiResponse<{ user: User }>> {
        return this.request(`/api/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(params),
        });
    }

    async getUserRegistrationLink(
        userId: string
    ): Promise<ApiResponse<{ registrationLink: string | null }>> {
        return this.request(`/api/admin/users/${userId}`);
    }

    async getSettings(): Promise<ApiResponse<{ settings: AppSettings }>> {
        return this.request(`/api/admin/settings`);
    }

    async getPublicSettings(): Promise<ApiResponse<{ settings: AppSettings }>> {
        return this.request(`/api/settings`);
    }

    async updateSettings(
        params: AppSettingsRequest
    ): Promise<ApiResponse<{ settings: AppSettings }>> {
        return this.request(`/api/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify(params),
        });
    }

    async getAdminWorkSessions(
        params: AdminWorkSessionsQueryWithPagination
    ): Promise<ApiResponse<AdminWorkSessionsResponse>> {
        const search = new URLSearchParams();
        search.set('period', params.period);
        if (params.date) search.set('date', params.date);
        if (params.year !== undefined) search.set('year', String(params.year));
        if (params.month !== undefined)
            search.set('month', String(params.month));
        if (params.limit !== undefined)
            search.set('limit', String(params.limit));
        if (params.offset !== undefined)
            search.set('offset', String(params.offset));
        return this.request(`/api/admin/work-sessions?${search.toString()}`);
    }

    async replaceDayWorkSessions(
        userId: string,
        date: string,
        sessions: AdminWorkSessionInput[]
    ): Promise<ApiResponse<{ workSessions: WorkSession[] }>> {
        const body: AdminReplaceDayWorkSessionsRequest = {
            userId,
            date,
            sessions,
        };
        return this.request(`/api/admin/work-sessions`, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    async getAllVacationsYearAdmin(
        year: number
    ): Promise<ApiResponse<YearlyVacationResponse>> {
        return this.request(`/api/admin/vacations/${year}`);
    }

    async resolveVacation(
        vacationId: string,
        status: typeof VACATION_APPROVED | typeof VACATION_REJECTED
    ): Promise<ApiResponse<{ success: boolean }>> {
        return this.request(`/api/admin/vacations/resolve/${vacationId}`, {
            method: 'POST',
            body: JSON.stringify({ status }),
        });
    }

    async getYearlyVacationsGlobal(
        year: number
    ): Promise<ApiResponse<{ vacations: YearlyVacationDays }>> {
        return this.request(`/api/vacations/yearly/${year}`, {
            method: 'GET',
        });
    }

    async setYearlyVacationsAdmin(
        vacations: YearlyVacationAdminRequest
    ): Promise<ApiResponse<{ success: boolean }>> {
        return this.request(`/api/admin/vacations/set-yearly`, {
            method: 'POST',
            body: JSON.stringify(vacations),
        });
    }

    async createVacation(
        vacationRequest: ElectiveVacationRequest
    ): Promise<ApiResponse<{ vacation: ElectiveVacation }>> {
        return this.request(`/api/vacations/create`, {
            method: 'POST',
            body: JSON.stringify(vacationRequest),
        });
    }

    async cancelVacation(
        vacationId: string
    ): Promise<ApiResponse<{ success: boolean }>> {
        return this.request(`/api/vacations/${vacationId}/cancel`, {
            method: 'POST',
        });
    }

    async getUserVacations(
        userId: string,
        year: number | string
    ): Promise<ApiResponse<YearlyVacationResponse>> {
        return this.request(`/api/vacations/user/${userId}/${year}`);
    }

    async getTeamVacations(
        year: number | string
    ): Promise<ApiResponse<{ vacations: TeamVacation[] }>> {
        return this.request(`/api/groups/team-vacations?year=${year}`);
    }

    async getWorkSessionReasons(): Promise<
        ApiResponse<{ reasons: WorksessionReason[] }>
    > {
        // Reasons are effectively static per company — cache for the session.
        if (!this.reasonsPromise) {
            this.reasonsPromise = this.request(`/api/work-sessions/reasons`);
        }
        return this.reasonsPromise;
    }

    async addWorkRecordTimestamp(info: WorkSessionRequest): Promise<
        ApiResponse<{
            message: string;
            session: WorkSession;
            hoursWorked: number | null;
        }>
    > {
        return this.request('/api/work-sessions/add-timestamp', {
            method: 'POST',
            body: JSON.stringify(info),
        });
    }

    async getDailyRecords(
        userId: string,
        date: Date
    ): Promise<ApiResponse<{ workSessions: WorkSession[] }>> {
        return this.request(
            `/api/work-sessions/${userId}/day/${toLocalDateKey(date)}`
        );
    }

    async getWorkSessionRange(
        userId: string,
        from: string,
        to: string
    ): Promise<ApiResponse<{ workSessions: WorkSession[] }>> {
        return this.request(
            `/api/work-sessions/${userId}/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
    }

    async getMonthlyRecords(
        userId: string,
        month: number | string,
        year: number | string
    ): Promise<ApiResponse<MonthlyWorkRecordResponse>> {
        return this.request(
            `/api/work-sessions/${userId}/month/${year}/${month}`
        );
    }

    async getCompanyUsers(): Promise<ApiResponse<{ users: User[] }>> {
        return this.request(`/api/admin/users`);
    }

    async getAdminDashboard(): Promise<ApiResponse<AdminDashboardResponse>> {
        return this.request(`/api/admin/dashboard`);
    }

    async exportWorkSessions(
        userIds: string[],
        options?: { from?: string; to?: string }
    ): Promise<ApiResponse<null>> {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const params = new URLSearchParams();
        params.set('userIds', userIds.join(','));
        if (options?.from) params.set('from', options.from);
        if (options?.to) params.set('to', options.to);
        const endpoint = `/api/admin/export/work-sessions?${params.toString()}`;

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (!response.ok) {
                let data: { error?: string; details?: unknown } = {};
                try {
                    data = await response.json();
                } catch (e) {
                    data = {};
                }
                const error = (data.error ||
                    response.statusText ||
                    'Request failed') as ErrorCode;
                const result: ApiResponse<null> = {
                    error,
                    details: (data.details ?? {}) as ErrorDetails,
                };
                if (this.errorListener) {
                    this.errorListener(
                        result.error ?? 'Request failed',
                        result.details
                    );
                }
                return result;
            }

            const blob = await response.blob();
            triggerDownload(
                blob,
                `work_sessions_${new Date().toISOString().slice(0, 10)}.csv`
            );
            return { data: null };
        } catch (error) {
            const result: ApiResponse<null> = { error: 'NetworkError' };
            if (this.errorListener && result.error) {
                this.errorListener(result.error);
            }
            return result;
        }
    }
}

export const apiClient = new ApiClient();
