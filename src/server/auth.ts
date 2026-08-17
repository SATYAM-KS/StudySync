import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from './db.ts';
import { User } from '../types/index.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'studycampaign-secure-jwt-key-2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    const user = await getUserById(decoded.id);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const { passwordHash, ...cleanUser } = user;
    req.user = cleanUser;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
      const user = await getUserById(decoded.id);
      if (user) {
        const { passwordHash, ...cleanUser } = user;
        req.user = cleanUser;
      }
    } catch {
      // ignore
    }
  }
  next();
}

export function generateResetToken(email: string, code: string): string {
  return jwt.sign(
    {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      type: 'password_reset'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export function verifyResetToken(token: string, email: string, code: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; code: string; type: string };
    return (
      decoded.type === 'password_reset' &&
      decoded.email === email.trim().toLowerCase() &&
      decoded.code === code.trim()
    );
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  isValid: boolean;
  hasMinLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  error?: string;
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const pwd = password || '';
  const hasMinLength = pwd.length >= 8;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);

  const isValid = hasMinLength && hasLower && hasUpper && hasNumber && hasSymbol;

  let error: string | undefined;
  if (!hasMinLength) {
    error = 'Password must be at least 8 characters long.';
  } else if (!hasLower) {
    error = 'Password must include at least one lowercase letter (a-z).';
  } else if (!hasUpper) {
    error = 'Password must include at least one uppercase letter (A-Z).';
  } else if (!hasNumber) {
    error = 'Password must include at least one number (0-9).';
  } else if (!hasSymbol) {
    error = 'Password must include at least one special symbol (!@#$%^&* etc.).';
  }

  return {
    isValid,
    hasMinLength,
    hasLower,
    hasUpper,
    hasNumber,
    hasSymbol,
    error
  };
}

