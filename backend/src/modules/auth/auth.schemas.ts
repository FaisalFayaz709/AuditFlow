import { z } from 'zod';

export const RegisterBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(320),
  password: z.string().min(12).max(200),
  companyName: z.string().trim().min(1).max(160),
});

export const LoginBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export const ForgotPasswordBodySchema = z.object({
  email: z.string().email().max(320),
});

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(32).max(512),
  newPassword: z.string().min(12).max(200),
});

export const VerifyEmailBodySchema = z.object({
  token: z.string().min(32).max(512),
});

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;
export type VerifyEmailBody = z.infer<typeof VerifyEmailBodySchema>;
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;
