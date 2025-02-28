declare module 'basic-ftp' {
    // Define the types based on the package's documentation
    export class Client {
      connect(options: { host: string; port?: number; user?: string; password?: string }): Promise<void>;
      uploadFrom(source: string, destination: string): Promise<void>;
      downloadTo(destination: string, source: string): Promise<void>;
      close(): Promise<void>;
    }
  }