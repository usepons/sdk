/**
 * ModuleRunner — base class for module processes.
 *
 * Extend this class to build a module. The runner handles:
 *   - IPC with kernel (ready, log, ack, nack, publish, call, rpc)
 *   - Graceful shutdown on kernel 'shutdown' message
 *   - Ping/pong health checks
 *   - Cross-module RPC via kernel routing
 *
 * Usage:
 *   class MyModule extends ModuleRunner {
 *     manifest = { id: 'my-module', ... };
 *     async onMessage(topic, payload) { ... }
 *   }
 *   new MyModule().start();
 */

const randomUUID = (): string => crypto.randomUUID();
import type { Logger } from './logger.ts';
import type { ModuleManifest, ModulePermissions } from './module-types.ts';
import type { KernelMessage, ModuleMessage } from './ipc-protocol.ts';

interface PendingPromise {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export abstract class ModuleRunner {
  abstract readonly manifest: ModuleManifest;

  protected config: unknown = null;
  protected workspacePath = '';
  protected projectRoot = '';
  /** Whether init has already been processed — guards against double init. */
  private _initialized = false;

  // ─── Start ────────────────────────────────────────────────

  start(): void {
    this.readStdin();
  }

  /**
   * Read newline-delimited JSON from stdin (kernel → module IPC).
   * Keeps the event loop alive as long as the kernel holds the pipe open.
   */
  private async readStdin(): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for await (const chunk of Deno.stdin.readable) {
        buffer += decoder.decode(chunk, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line) as KernelMessage;
            this.handleKernelMessage(msg).catch((err) => {
              this.log('error', err instanceof Error ? err.message : String(err));
            });
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
    } catch {
      // stdin closed — kernel terminated
    }

    // Stdin closed means kernel is gone — cleanup and exit
    try {
      await this.onShutdown();
    } catch {
      // shutdown handler may fail if kernel is gone — that's OK
    }
    Deno.exit(0);
  }

  // ─── Handle messages from kernel ─────────────────────────

  private async handleKernelMessage(msg: KernelMessage): Promise<void> {
    switch (msg.type) {
      case 'init':
        if (this._initialized) {
          // Ignore duplicate init — module already running
          break;
        }
        this._initialized = true;
        this.config = msg.config;
        this.workspacePath = msg.workspacePath;
        this.projectRoot = msg.projectRoot;
        await this.onInit();
        // Auto-check and request missing permissions before declaring ready
        await this.ensurePermissions();
        this.send({ type: 'ready', manifest: this.manifest });
        break;

      case 'deliver':
        try {
          await this.onMessage(msg.topic, msg.payload);
          this.send({ type: 'ack', id: msg.id });
        } catch (err) {
          this.send({ type: 'nack', id: msg.id, error: String(err) });
        }
        break;

      case 'ping':
        this.send({ type: 'pong' });
        break;

      case 'install':
        await this.onInstall();
        break;

      case 'shutdown':
        await this.onShutdown();
        Deno.exit(0);
        break;

      case 'deps_ready':
        await this.onDepsReady();
        break;

      case 'service_available':
        await this.onServiceAvailable(msg.service);
        break;

      // Kernel → module call (e.g., kernel invokes a method on this module)
      case 'call':
        try {
          const result = await this.onRequest(msg.method, msg.params);
          this.send({ type: 'call:response', id: msg.id, result });
        } catch (err) {
          this.send({ type: 'call:response', id: msg.id, error: String(err) });
        }
        break;

      case 'config:update':
        this.config = msg.config;
        await this.onConfigUpdate(msg.changedSections);
        break;

      // Response to this module's kernel call
      case 'call:response':
        this.resolvePending(this.pendingCalls, msg.id, msg.result, msg.error);
        break;

      // Incoming RPC request from another module (forwarded by kernel)
      case 'rpc_request':
        try {
          const result = await this.onRequest(msg.method, msg.params);
          this.send({ type: 'rpc_response', id: msg.id, result });
        } catch (err) {
          this.send({ type: 'rpc_response', id: msg.id, error: String(err) });
        }
        break;

      // Response to this module's RPC request
      case 'rpc_response':
        this.resolvePending(this.pendingRequests, msg.id, msg.result, msg.error);
        break;
    }
  }

  // ─── Overridable hooks ────────────────────────────────────

  /** Called on first-ever spawn before init. Request permissions here. */
  protected async onInstall(): Promise<void> {}

  /** Called after kernel sends 'init'. Set up connections, load state. */
  protected async onInit(): Promise<void> {}

  /** Called for each message delivered from the bus. */
  protected abstract onMessage(topic: string, payload: unknown): Promise<void>;

  /** Called when all required services are available. Override for deferred initialization. */
  protected async onDepsReady(): Promise<void> {}

  /**
   * Called when an optional service (from optionalRequires) becomes available.
   * Default: re-runs onDepsReady so modules can register routes, etc.
   */
  protected async onServiceAvailable(_service: string): Promise<void> {
    await this.onDepsReady();
  }

  /** Called before shutdown. Persist state here. */
  protected async onShutdown(): Promise<void> {}

  /** Called when config is hot-reloaded. Override to react to specific section changes. */
  protected async onConfigUpdate(_changedSections: string[]): Promise<void> {}

  /**
   * Handle incoming RPC requests (from other modules or kernel).
   * Override to expose service methods.
   */
  protected async onRequest(_method: string, _params: unknown): Promise<unknown> {
    throw new Error(`Unhandled RPC method: ${_method}`);
  }

  // ─── Kernel communication ─────────────────────────────────

  /** Send a log message to kernel (kernel writes it centrally). */
  protected log(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', msg: string, data?: Record<string, unknown>): void {
    this.send({ type: 'log', level, msg, data });
  }

  /** Send a grouped log — header line with sub-items rendered as a tree by the kernel. */
  protected logGroup(
    level: 'info' | 'warn' | 'error' | 'debug',
    msg: string,
    data: Record<string, unknown> | undefined,
    items: Array<{ msg: string; data?: Record<string, unknown> }>,
  ): void {
    this.send({ type: 'log-group', level, msg, data, items });
  }

  /** Publish a message to the bus — kernel routes it to subscribers. */
  protected publish(topic: string, payload: unknown): void {
    this.send({ type: 'publish', topic, payload });
  }

  // ─── Kernel service calls ─────────────────────────────────

  private pendingCalls = new Map<string, PendingPromise>();

  /** Call a kernel service (config.get, module.list, service.discover, etc.) */
  protected call(method: string, params?: unknown, timeoutMs = 10_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`Kernel call ${method} timed out`));
      }, timeoutMs);

      this.pendingCalls.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
        timer,
      });

      this.send({ type: 'call', id, method, params });
    });
  }

  // ─── Cross-module RPC ──────────────────────────────────────

  private pendingRequests = new Map<string, PendingPromise>();

  /**
   * Call a method on another module's service.
   * Kernel routes the request to the module that provides the service.
   *
   * @param service - Service name (from target module's manifest.provides)
   * @param method  - Method name (handled by target's onRequest)
   * @param params  - Optional parameters
   * @param timeoutMs - Timeout in ms (default 30s)
   */
  protected request<T = unknown>(service: string, method: string, params?: unknown, timeoutMs = 30_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC ${service}.${method} timed out`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v as T); },
        reject: (e) => { clearTimeout(timer); reject(e); },
        timer,
      });

      this.send({ type: 'rpc_request', id, service, method, params });
    });
  }

  // ─── Service discovery ────────────────────────────────────

  /** Discover all available services across modules */
  protected async discoverServices(): Promise<Array<{ service: string; moduleId: string }>> {
    return this.call('service.discover') as Promise<Array<{ service: string; moduleId: string }>>;
  }

  /** Resolve which module provides a service */
  protected async resolveService(service: string): Promise<string> {
    return this.call('service.resolve', { service }) as Promise<string>;
  }

  // ─── Permissions ─────────────────────────────────────────────

  /** Request permissions from the kernel (typically called during onInstall). */
  /**
   * Auto-check manifest permissions on boot and request any that are missing.
   * Called automatically during init — modules don't need to call this.
   */
  private async ensurePermissions(): Promise<void> {
    const perms = this.manifest.permissions;
    if (!perms) return;

    const { granted, missing } = await this.checkPermissions(perms);
    if (granted) return;

    await this.requestPermissions(missing, `Module "${this.manifest.id}" requires these permissions to function`);
  }

  async requestPermissions(
    permissions: Partial<ModulePermissions>,
    reason?: string,
  ): Promise<{ granted: boolean; pending?: boolean; denied?: boolean; requestId?: string }> {
    return this.call('permissions.request', { permissions, reason }) as Promise<{ granted: boolean; pending?: boolean; denied?: boolean; requestId?: string }>;
  }

  /** Check whether this module currently has the given permissions. */
  async checkPermissions(
    permissions: Partial<ModulePermissions>,
  ): Promise<{ granted: boolean; missing: Partial<ModulePermissions> }> {
    return this.call('permissions.check', { permissions }) as Promise<{ granted: boolean; missing: Partial<ModulePermissions> }>;
  }

  // ─── Adapter factories ───────────────────────────────────────

  /**
   * Create a stub EventEmitter that bridges emit() to this.publish().
   * Single-arg events pass the payload directly; multi-arg wraps in { args }.
   * All listener methods return the adapter for chaining.
   */
  protected createEventAdapter(): unknown {
    const adapter: Record<string, unknown> = {
      emit: (event: string, ...args: unknown[]) => {
        if (args.length === 1) {
          this.publish(event, args[0]);
        } else {
          this.publish(event, { args });
        }
        return true;
      },
      listenerCount: () => 0,
      listeners: () => [],
      rawListeners: () => [],
      eventNames: () => [],
      getMaxListeners: () => 10,
    };
    // Chainable stubs
    for (const m of ['on', 'off', 'once', 'removeAllListeners', 'addListener', 'removeListener', 'setMaxListeners', 'prependListener', 'prependOnceListener']) {
      adapter[m] = () => adapter;
    }
    return adapter;
  }

  /**
   * Create a pino-compatible logger that routes through IPC to the kernel.
   * Supports child() bindings — merged bindings are forwarded as data in log messages.
   */
  protected createLoggerAdapter(bindings?: Record<string, unknown>): Logger {
    const runner = this;
    const mergedBindings = bindings;

    const levelValues: Record<string, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

    const makeAdapter = (b?: Record<string, unknown>): Logger => {
      const adapter: Record<string, unknown> = {
        level: 'info',
        isLevelEnabled: (lvl: string) => (levelValues[lvl] ?? 0) >= (levelValues[adapter.level as string] ?? 0),
        child: (childBindings: Record<string, unknown>) =>
          makeAdapter({ ...b, ...childBindings }),
      };
      for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) {
        adapter[level] = (obj: unknown, msg?: string) => {
          const data: Record<string, unknown> = { ...b };
          if (typeof obj === 'object' && obj !== null) {
            Object.assign(data, obj);
            runner.log(level, msg ?? '', Object.keys(data).length > 0 ? data : undefined);
          } else {
            runner.log(level, msg ?? String(obj), Object.keys(data).length > 0 ? data : undefined);
          }
        };
      }
      return adapter as unknown as Logger;
    };

    return makeAdapter(mergedBindings);
  }

  // ─── Internal helpers ──────────────────────────────────────

  private resolvePending(map: Map<string, PendingPromise>, id: string, result?: unknown, error?: string): void {
    const pending = map.get(id);
    if (!pending) return;
    map.delete(id);
    clearTimeout(pending.timer);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  }

  private generateId(): string {
    return randomUUID();
  }

  private encoder = new TextEncoder();
  /** Set to true when stdout write fails — all further sends are no-ops. */
  private _channelClosed = false;

  private send(msg: ModuleMessage): void {
    if (this._channelClosed) return;
    try {
      const line = JSON.stringify(msg) + '\n';
      Deno.stdout.writeSync(this.encoder.encode(line));
    } catch {
      // stdout closed — kernel is gone; reject all pending calls/requests
      this._channelClosed = true;
      this.drainPendingOnClose();
    }
  }

  /** Reject all pending calls and requests when the IPC channel is lost. */
  private drainPendingOnClose(): void {
    const err = new Error('IPC channel closed — kernel disconnected');
    for (const [, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingCalls.clear();
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }
}
