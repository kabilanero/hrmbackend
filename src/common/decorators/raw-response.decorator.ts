import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';
/** Opt out of the standard `{ success, data }` response envelope. */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
