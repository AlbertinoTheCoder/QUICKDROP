import {relayCredentials,RelayEnv} from '../../server/relay';

export function onRequest(context: {request: Request; env: RelayEnv}) {
  return relayCredentials(context.request, context.env);
}
