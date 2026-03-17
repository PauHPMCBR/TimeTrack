import type {
  CreateGroupRequest,
  CreateUserRequest,
  ElectiveVacationRequest,
  LoginRequest,
  MonthlyWorkRecordResponse,
  RegisterRequest,
  UserLoginResponse,
  WorkSessionRequest,
  YearlyVacationAdminRequest,
  YearlyVacationResponse,
} from '@/schemas/api'
import { ElectiveVacation, Group, User, WorkSession, WorksessionReason, YearlyVacationDays } from '@/types'
import { ApiResponse } from '@/types/apiErrors'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

class ApiClient {
  private currentUser: User | undefined = undefined;
  private errorListener: ((error: string, details?: any) => void) | null = null;

  setErrorListener(listener: ((error: string, details?: any) => void) | null) {
    this.errorListener = listener;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = localStorage.getItem('auth_token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      
      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: 'InvalidJsonResponse' };
      }

      if (!response.ok) {
        const error = data.error || response.statusText || 'Request failed';
        const result = { 
          error,
          details: data 
        };
        if (this.errorListener) {
          this.errorListener(result.error, result.details);
        }
        return result;
      }

      if (data.data) {
        return { data: data.data };
      }

      return { data };
    } catch (error) {
      const result: ApiResponse<any> = { error: 'NetworkError' };
      if (this.errorListener && result.error) {
        this.errorListener(result.error);
      }
      return result;
    }
  }

  async getCurrentUser(): Promise<User | undefined> {
    if (this.currentUser === undefined) {
      const prof = await this.getProfile();
      this.currentUser = (prof).data?.user;
    }
    return this.currentUser;
  }

  // Auth methods
  async login(credentials: LoginRequest): Promise<ApiResponse<UserLoginResponse>> {
    return await this.request<UserLoginResponse>(`/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logoff() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("remembered_email");
    this.currentUser = undefined;
  }

  async register(credentials: RegisterRequest): Promise<ApiResponse<UserLoginResponse>> {
    return this.request<UserLoginResponse>(`/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  // Group methods
  async getGroupInfo(groupId: string): Promise<ApiResponse<{ group: Group }>> {
    return this.request(`/api/groups/${groupId}`);
  }

  async getUserGroups(userId: string): Promise<ApiResponse<{ groups: Group[] }>> {
    return this.request(`/api/groups/user/${userId}`);
  }

  async getAllGroups(): Promise<ApiResponse<{ groups: Group[] }>> {
    return this.request(`/api/admin/groups`);
  }

  async updateGroup(groupId: string, newGroupParams: CreateGroupRequest): Promise<ApiResponse<{ group: Group }>> {
    return this.request(`/api/groups/update/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(newGroupParams),
    });
  }

  async deleteGroup(groupId: string): Promise<ApiResponse<{}>> {
    return this.request(`/api/groups/update/${groupId}`, {
      method: 'DELETE',
    });
  }

  async createGroup(newGroupParams: CreateGroupRequest): Promise<ApiResponse<{ group: Group }>> {
    return this.request(`/api/groups/create`, {
      method: 'POST',
      body: JSON.stringify(newGroupParams),
    });
  }

  // User methods
  async getProfile(userId?: string): Promise<ApiResponse<{ user: User }>> {
    if (userId === undefined) {
      return this.request(`/api/profile/me`);
    }
    return this.request(`/api/profile/${userId}`);
  }

  async createUser(userCreated: CreateUserRequest): Promise<ApiResponse<{ user: User, registrationLink?: string, registrationToken?: string }>> {
    return this.request(`/api/profile/create`, {
      method: 'POST',
      body: JSON.stringify(userCreated),
    });
  }

  async getAllVacationsYearAdmin(year: number): Promise<ApiResponse<YearlyVacationResponse>> {
    return this.request(`/api/admin/vacations/${year}`);
  }

  async getAllPendingVacations(): Promise<ApiResponse<{ vacations: ElectiveVacation[] }>> {
    return this.request(`/api/admin/vacations/pending-vacations`);
  }

  async getCurrentlyWorking(): Promise<ApiResponse<{ count: number, users: any[] }>> {
    return this.request(`/api/admin/currently-working`);
  }

  async resolveVacation(vacationId: string, status: 'approved' | 'rejected'): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/admin/vacations/resolve/${vacationId}`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async getYearlyVacationsGlobal(year: number): Promise<ApiResponse<{ vacations: YearlyVacationDays }>> {
    return this.request(`/api/vacations/yearly/${year}`, {
      method: 'GET',
    });
  }

  async setYearlyVacationsAdmin(vacations: YearlyVacationAdminRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/admin/vacations/set-yearly`, {
      method: 'POST',
      body: JSON.stringify(vacations),
    });
  }

  async createVacation(vacationRequest: ElectiveVacationRequest): Promise<ApiResponse<{ vacation: ElectiveVacation }>> {
    return this.request(`/api/vacations/create`, {
      method: 'POST',
      body: JSON.stringify(vacationRequest),
    });
  }

  async cancelVacation(vacationId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/vacations/${vacationId}/cancel`, {
      method: 'POST',
    });
  }

  async getUserVacations(userId: string, year: number | string): Promise<ApiResponse<YearlyVacationResponse>> {
    return this.request(`/api/vacations/user/${userId}/${year}`);
  }

  async getTeamVacations(year: number | string): Promise<ApiResponse<{ vacations: any[] }>> {
    return this.request(`/api/groups/team-vacations?year=${year}`);
  }

  // Work session methods
  async getWorkSessionReasons(): Promise<ApiResponse<{ reasons: WorksessionReason[] }>> {
    return this.request(`/api/work-sessions/reasons`);
  }

  async addWorkRecordTimestamp(info: WorkSessionRequest): Promise<ApiResponse<{ workSession: WorkSession }>> {
    return this.request('/api/work-sessions/add-timestamp', {
      method: 'POST',
      body: JSON.stringify(info),
    });
  }

  async getDailyRecords(userId: string, date: Date): Promise<ApiResponse<{ workSessions: WorkSession[] }>> {
    return this.request(`/api/work-sessions/${userId}/day/${date.toISOString()}`);
  }

  async getMonthlyRecords(userId: string, month: number | string, year: number | string): Promise<ApiResponse<MonthlyWorkRecordResponse>> {
    return this.request(`/api/work-sessions/${userId}/month/${year}/${month}`);
  }

  async getCompanyUsers(): Promise<ApiResponse<{ users: User[] }>> {
    return this.request(`/api/admin/users`);
  }
}

export const apiClient = new ApiClient();