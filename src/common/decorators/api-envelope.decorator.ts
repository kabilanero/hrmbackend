import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiCreatedResponse, getSchemaPath } from '@nestjs/swagger';

type Mode = 'ok' | 'created';

function envelope(dataSchema: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      statusCode: { type: 'number', example: 200 },
      data: dataSchema,
      ...extra,
      path: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  };
}

/** Documents a single-object response inside the standard envelope. */
export const ApiEnvelope = <T extends Type<unknown>>(model: T, mode: Mode = 'ok') =>
  applyDecorators(
    ApiExtraModels(model),
    (mode === 'created' ? ApiCreatedResponse : ApiOkResponse)({
      schema: envelope({ $ref: getSchemaPath(model) }),
    }),
  );

/** Documents an array response inside the standard envelope. */
export const ApiEnvelopeArray = <T extends Type<unknown>>(model: T) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({ schema: envelope({ type: 'array', items: { $ref: getSchemaPath(model) } }) }),
  );

/** Documents a paginated response (data = items, meta = page info). */
export const ApiPaginatedEnvelope = <T extends Type<unknown>>(model: T) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: envelope(
        { type: 'array', items: { $ref: getSchemaPath(model) } },
        {
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              size: { type: 'number' },
              totalItems: { type: 'number' },
              totalPages: { type: 'number' },
              hasNext: { type: 'boolean' },
              hasPrevious: { type: 'boolean' },
            },
          },
        },
      ),
    }),
  );
