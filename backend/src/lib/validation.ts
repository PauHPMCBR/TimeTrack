import { responseErrorValidation } from '@/lib/response-error-generator';
import { NextApiRequest, NextApiResponse } from 'next';
import { ZodSchema } from 'zod/v3';

export const validateRequestBody = (schema: ZodSchema) => {
  return (req: NextApiRequest, res: NextApiResponse, next: Function) => {
    try {
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch (parseError) {
          console.log('Parse error: ', parseError);
          return responseErrorValidation(res, ['Invalid JSON in request body'], 'Request body must be valid JSON');
        }
      }

      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      console.log('validation error: ', error);
      return responseErrorValidation(res, error.errors, error.message);
    }
  };
};

export const validateQueryParams = (schema: ZodSchema) => {
  return (req: NextApiRequest, res: NextApiResponse, next: Function) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error: any) {
      return responseErrorValidation(res, error.errors, error.message);
    }
  };
};

export const validateResponse = (schema: ZodSchema) => {
  return (data: any) => {
    return schema.parse(data);
  };
};