import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { User, Group } from '@/models';
import { responseError } from './response-error-generator';

export interface AuthRequest extends NextApiRequest {
  user?: {
    userId: string;
    email: string;
    role: 'employee' | 'admin' | 'manager';
  };
}

export const authenticateToken = (handler: Function) => {
  return async (req: AuthRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return responseError(res, 401, 'TokenRequired');
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
      const user = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: 'employee' | 'admin' | 'manager' };
      req.user = user;
      return handler(req, res);
    } catch (error) {
      return responseError(res, 403, 'InvalidToken');
    }
  };
};

export const requireRole = (roles: string[], handler: Function) => {
  return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return responseError(res, 403, 'InsufficientPermissions');
    }
    return handler(req, res);
  });
};

export const requireSameGroupOrAdmin = (handler: Function) => {
  return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
    try {
      if (req.user?.role === 'admin') {
        return handler(req, res);
      }

      const targetUserId = req.query.userId as string;

      const currentUser = await User.findById(req.user?.userId);
      const targetUser = await User.findById(targetUserId);

      if (!currentUser || !targetUser) {
        return responseError(res, 404, 'UserNotFound');
      }

      const currentUserGroups = currentUser.groups.map((g: any) => g.toString());
      const targetUserGroups = targetUser.groups.map((g: any) => g.toString());
      const sharedGroups = currentUserGroups.filter((groupId: any) => targetUserGroups.includes(groupId));

      if (sharedGroups.length === 0) {
        return responseError(res, 403, 'NoAccessToUser');
      }

      return handler(req, res);
    } catch (error) {
      return responseError(res, 500, 'PermissionVerificationError');
    }
  });
};

export const requireInGroupOrAdmin = (handler: Function) => {
  return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
    try {
      if (req.user?.role === 'admin') {
        return handler(req, res);
      }

      const groupId = req.query.groupId as string;

      const user = await User.findById(req.user?.userId);
      if (!user) {
        return responseError(res, 404, 'UserNotFound');
      }

      const group = await Group.findById(groupId);
      if (!req.user?.userId || !group.members.includes(req.user.userId)) {
        return responseError(res, 403, 'NoAccessToGroup');
      }

      return handler(req, res);
    } catch (error) {
      return responseError(res, 500, 'PermissionVerificationError');
    }
  });
};