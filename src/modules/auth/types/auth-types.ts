// Authentication Module Types
// 認證模組類型定義

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    email: string;
    username: string;
    role: string;
    teamId?: number;
  };
  message?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  agent: Agent;
}

export interface SessionData {
  userId: number;
  role: string;
  teamId?: number;
  createdAt: string;
  expiresAt: string;
}

export interface JWTPayload {
  userId: number | string;
  username?: string;
  displayName: string;
  email?: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier to 2-tier role system
  primaryTeamId?: number;  // From agent_teams WHERE isPrimary=true
  iat: number;
  exp: number;
  type?: 'access' | 'refresh' | 'temp_password_change';
  isSystemToken?: boolean;
}

export interface RolePermissions {
  [key: string]: string[];
}

export interface AuthMiddlewareConfig {
  requireAuth?: boolean;
  requireRole?: string;
  requireTeam?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

// Re-export shared types that auth module needs
export type { Bindings } from '@/types';

// Agent and Team types from database schema
import type { agents, teams } from '@/db/schema';
export type Agent = typeof agents.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type NewTeam = typeof teams.$inferInsert;