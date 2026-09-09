// SignWell's embedded editor is loaded as a plain <script> tag
// (https://static.signwell.com/assets/embedded.js) that attaches a
// global SignWellEmbed class to window — there's no npm package or
// bundled types for it, so this is a minimal ambient declaration
// covering only what StaffSignatureRequests.tsx actually uses.
export {};

declare global {
  interface SignWellEmbedEvents {
    completed?: (data?: unknown) => void;
    iframeLoaded?: (data?: unknown) => void;
    documentLoaded?: (data?: unknown) => void;
    closed?: (data?: unknown) => void;
    error?: (data?: unknown) => void;
  }

  interface SignWellEmbedOptions {
    url: string;
    containerId?: string;
    allowClose?: boolean;
    events?: SignWellEmbedEvents;
  }

  interface Window {
    SignWellEmbed?: new (options: SignWellEmbedOptions) => {
      open(): void;
      getDocument(): Promise<unknown>;
    };
  }
}
