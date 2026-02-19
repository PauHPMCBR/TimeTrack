import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { Group } from '@/models'; // <--- Importem Group, no User
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();

    // Busquem TOTS els grups
    const groups = await Group.find({}); 
    
    // Retornem l'objecte { groups: [...] }
    res.status(200).json({
      groups: groups
    });
  } catch (error) {
    console.error('Admin get groups error:', error);
    return responseErrorGet(res);
  }
}

export default requireRole(['admin'], handler);