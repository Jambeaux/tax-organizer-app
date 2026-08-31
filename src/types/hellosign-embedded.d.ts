// hellosign-embedded ships no TypeScript types of its own and there's no
// @types package for it — this is a minimal ambient declaration covering
// only what StaffSignatureRequests.tsx actually uses.
declare module "hellosign-embedded" {
  export type HelloSignEvent = "send" | "close" | "cancel" | "error" | "message";

  export interface HelloSignOpenOptions {
    clientId: string;
    skipDomainVerification?: boolean;
    testMode?: boolean;
  }

  export default class HelloSign {
    constructor(config?: { clientId?: string });
    open(url: string, options?: HelloSignOpenOptions): void;
    close(): void;
    on(event: HelloSignEvent, callback: (data?: unknown) => void): void;
    off(event: HelloSignEvent, callback?: (data?: unknown) => void): void;
  }
}
