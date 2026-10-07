import { z } from 'zod';
import { membershipRoles } from '../../shared/tenant-context.js';

export const CompanyIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const CompanyCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  industry: z.string().trim().min(1).max(120).nullable().optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
});

export const CompanyUpdateBodySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  industry: z.string().trim().min(1).max(120).nullable().optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one update field is required.',
});

export const MemberIdParamsSchema = z.object({
  companyId: z.string().min(1),
  memberId: z.string().min(1),
});

export const CompanyMembersParamsSchema = z.object({
  id: z.string().min(1),
});

export const RoleChangeBodySchema = z.object({
  role: z.enum(membershipRoles),
});

export const RemoveMemberBodySchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export type CompanyCreateBody = z.infer<typeof CompanyCreateBodySchema>;
export type CompanyUpdateBody = z.infer<typeof CompanyUpdateBodySchema>;
export type RoleChangeBody = z.infer<typeof RoleChangeBodySchema>;
export type RemoveMemberBody = z.infer<typeof RemoveMemberBodySchema>;
