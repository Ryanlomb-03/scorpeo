declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CLOUDFLARE_ACCOUNT_ID: string;
      CLOUDFLARE_API_TOKEN: string;
      NVIDIA_API_KEY: string;
      GROQ_API_KEY: string;
    }
  }
}

export {};
