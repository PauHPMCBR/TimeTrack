export interface IUser {
  _id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager';
  createdAt: Date;
}

export interface ITimeRecord {
  _id: string;
  userId: string;
  checkIn: Date;
  checkOut?: Date;
  createdAt: Date;
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export interface CheckInOutRequest {
  notes?: string;
}