import { z } from 'zod';

export const invitationAssignableRoles = [
  'ADMIN',
  'COMPLIANCE_MANAGER',
  'MEMBER',
  'AUDITOR',
] as const;

export const InviteMemberParamsSchema = z.object({
  id: z.string().min(1),
});

export const InvitationIdParamsSchema = z.object({
  id: z.string().min(1),
  invitationId: z.string().min(1),
});

export const AcceptInvitationParamsSchema = z.object({
  token: z.string().min(32).max(512),
});

export const InviteMemberBodySchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(invitationAssignableRoles),
});

export const ResendInvitationBodySchema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
});

export type InviteMemberBody = z.infer<typeof InviteMemberBodySchema>;
export type ResendInvitationBody = z.infer<typeof ResendInvitationBodySchema>;
