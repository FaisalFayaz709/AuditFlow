import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AppEnv } from '../../config/env.js';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { EvidenceApproveBodySchema, EvidenceArchiveBodySchema, EvidenceIdParamsSchema, EvidenceListQuerySchema, EvidenceRejectBodySchema, EvidenceVersionIdParamsSchema, UploadMetadataSchema } from './evidence.schemas.js';
import { EvidenceService } from './evidence.service.js';

function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function resolveTenantFromHeader(request: FastifyRequest) {
  const actor = requireAuthenticatedUser(request);
  const companyId = getHeader(request, 'x-auditflow-company-id');
  if (!companyId) return null;
  return requireCompanyMembership({
    lookup: new PrismaCompanyMembershipLookup(request.server.prisma),
    userId: actor.userId,
    companyId,
  });
}

function activeCompanyRequired(request: FastifyRequest) {
  return {
    error: {
      code: 'ACTIVE_COMPANY_REQUIRED',
      message: 'Send x-auditflow-company-id to select a company context.',
      requestId: request.requestContext.requestId,
      details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
    },
  };
}

function readMultipartTextField(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const maybe = value as { value?: unknown };
  return typeof maybe.value === 'string' ? maybe.value : undefined;
}

async function readUploadRequest(request: FastifyRequest) {
  const part = await request.file();
  if (!part) {
    return null;
  }

  const buffer = await part.toBuffer();
  const metadata = UploadMetadataSchema.parse({
    title: readMultipartTextField(part.fields['title']),
    description: readMultipartTextField(part.fields['description']),
    sensitivityLevel: readMultipartTextField(part.fields['sensitivityLevel']) ?? 'INTERNAL',
  });

  return {
    file: {
      fileName: part.filename,
      mimeType: part.mimetype,
      buffer,
    },
    metadata,
  };
}

export const evidenceRoutes: FastifyPluginAsync<{ env: AppEnv }> = async (app, { env }) => {
  app.post('/api/evidence/upload', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));

    const upload = await readUploadRequest(request);
    if (!upload) {
      return reply.status(400).send({
        error: {
          code: 'UPLOAD_FILE_REQUIRED',
          message: 'Multipart upload must include one evidence file.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'file', reason: 'required' }],
        },
      });
    }

    const actor = requireAuthenticatedUser(request);
    const data = await new EvidenceService(app.prisma, env).uploadNewEvidence({
      tenant,
      ...upload,
      idempotencyKey: getHeader(request, 'idempotency-key'),
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.get('/api/evidence', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = EvidenceListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, { items: await new EvidenceService(app.prisma, env).listEvidence(tenant, query) });
  });

  app.get('/api/evidence/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceIdParamsSchema.parse(request.params);
    return sendData(request, reply, await new EvidenceService(app.prisma, env).getEvidenceDetail(tenant, params.id));
  });

  app.post('/api/evidence/:id/versions', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceIdParamsSchema.parse(request.params);
    const upload = await readUploadRequest(request);
    if (!upload) {
      return reply.status(400).send({
        error: {
          code: 'UPLOAD_FILE_REQUIRED',
          message: 'Multipart upload must include one evidence file.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'file', reason: 'required' }],
        },
      });
    }

    const actor = requireAuthenticatedUser(request);
    const data = await new EvidenceService(app.prisma, env).uploadNewVersion({
      tenant,
      evidenceItemId: params.id,
      ...upload,
      idempotencyKey: getHeader(request, 'idempotency-key'),
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.get('/api/evidence/:id/versions', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceIdParamsSchema.parse(request.params);
    return sendData(request, reply, { items: await new EvidenceService(app.prisma, env).listVersions(tenant, params.id) });
  });


  app.post('/api/evidence/versions/:versionId/approve', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionIdParamsSchema.parse(request.params);
    const body = EvidenceApproveBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const data = await new EvidenceService(app.prisma, env).approveEvidenceVersion({
      tenant,
      versionId: params.versionId,
      body,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });
    return sendData(request, reply, data);
  });

  app.post('/api/evidence/versions/:versionId/reject', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionIdParamsSchema.parse(request.params);
    const body = EvidenceRejectBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const data = await new EvidenceService(app.prisma, env).rejectEvidenceVersion({
      tenant,
      versionId: params.versionId,
      body,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });
    return sendData(request, reply, data);
  });

  app.delete('/api/evidence/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceIdParamsSchema.parse(request.params);
    const body = EvidenceArchiveBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const data = await new EvidenceService(app.prisma, env).archiveEvidenceItem({
      tenant,
      evidenceItemId: params.id,
      body,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });
    return sendData(request, reply, data);
  });

  app.get('/api/evidence/versions/:versionId/download', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionIdParamsSchema.parse(request.params);
    const actor = requireAuthenticatedUser(request);
    const download = await new EvidenceService(app.prisma, env).getAuthorizedDownload({
      tenant,
      versionId: params.versionId,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });

    reply.header('content-type', download.mimeType);
    reply.header('content-length', String(download.fileSize));
    reply.header('content-disposition', `attachment; filename="${download.fileName}"`);
    return reply.send(download.stream);
  });
};
