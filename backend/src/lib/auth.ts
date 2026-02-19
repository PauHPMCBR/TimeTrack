import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { User } from '@/models';

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
      return res.status(401).json({ error: 'Token d\'accés requerit' });
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
      const user = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: 'employee' | 'admin' | 'manager' };
      req.user = user;
      return handler(req, res);
    } catch (error) {
      return res.status(403).json({ error: 'Token invàlid o expirat' });
    }
  };
};

export const requireRole = (roles: string[], handler: Function) => {
  return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permisos insuficients' });
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

      if (req.user?.userId === targetUserId) {
        return handler(req, res);
      }

      const currentUser = await User.findById(req.user?.userId).populate('groups');
      const targetUser = await User.findById(targetUserId).populate('groups');

      if (!currentUser || !targetUser) {
        return res.status(404).json({ error: 'Usuari no trobat' });
      }

      const currentUserGroups = currentUser.groups.map((g: any) => g.toString());
      const targetUserGroups = targetUser.groups.map((g: any) => g.toString());
      const sharedGroups = currentUserGroups.filter((groupId: any) => targetUserGroups.includes(groupId));

      if (sharedGroups.length === 0) {
        return res.status(403).json({ error: 'No tens accés a aquest usuari' });
      }

      return handler(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Error verificant permisos' });
    }
  });
};