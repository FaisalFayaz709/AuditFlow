import type { FastifyReply, FastifyRequest } from 'fastify';

export type ApiMeta = {
  requestId: string;
};

export type ApiResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export function sendData<T>(request: FastifyRequest, reply: FastifyReply, data: T) {
  const requestId = request.requestContext.requestId;
  return reply.send({ data, meta: { requestId } } satisfies ApiResponse<T>);
}
