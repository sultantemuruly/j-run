/**
 * Polyfill for browser APIs needed by pdf-parse in Node.js environment
 * This must be imported BEFORE pdf-parse
 */

// Polyfill AbortController and AbortSignal FIRST (critical for pdf-parse)
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    signal: AbortSignal;
    
    constructor() {
      this.signal = new AbortSignal();
    }
    
    abort(reason?: any): void {
      this.signal.aborted = true;
      this.signal.reason = reason;
      if (this.signal.onabort) {
        this.signal.onabort();
      }
    }
  } as any;
}

if (typeof globalThis.AbortSignal === 'undefined') {
  globalThis.AbortSignal = class AbortSignal {
    aborted: boolean = false;
    reason: any = undefined;
    onabort: (() => void) | null = null;
    
    constructor() {
      // Ensure it can be called with 'new'
    }
    
    static abort(reason?: any): AbortSignal {
      const signal = new AbortSignal();
      signal.aborted = true;
      signal.reason = reason;
      return signal;
    }
    
    throwIfAborted(): void {
      if (this.aborted) {
        throw new Error('Aborted');
      }
    }
  } as any;
}

// Polyfill AbortException to fix "cannot be invoked without 'new'" error
// This is a known issue with pdf-parse - it tries to call AbortException without 'new'
// Enhanced version that works better with pdf-parse
if (typeof (globalThis as any).AbortException === 'undefined') {
  // Create a factory function that works with or without 'new'
  const AbortExceptionFactory = function AbortException(this: any, message?: string) {
    if (!(this instanceof AbortExceptionFactory)) {
      // Called without 'new' - create new instance
      return new AbortExceptionFactory(message);
    }
    // Called with 'new' - normal constructor
    this.name = 'AbortException';
    this.message = message || 'Aborted';
    this.stack = new Error().stack;
    Object.setPrototypeOf(this, AbortExceptionFactory.prototype);
  } as any;
  
  AbortExceptionFactory.prototype = Object.create(Error.prototype);
  AbortExceptionFactory.prototype.constructor = AbortExceptionFactory;
  AbortExceptionFactory.prototype.name = 'AbortException';
  
  // Make it callable as a function (for pdf-parse compatibility)
  const AbortExceptionFunction = function(message?: string) {
    return new AbortExceptionFactory(message);
  };
  Object.setPrototypeOf(AbortExceptionFunction, AbortExceptionFactory);
  Object.assign(AbortExceptionFunction, AbortExceptionFactory);
  
  // Make it available globally in multiple ways for maximum compatibility
  (globalThis as any).AbortException = AbortExceptionFactory;
  (globalThis as any).AbortException = AbortExceptionFunction;
  
  // Also set on global if it exists
  if (typeof global !== 'undefined') {
    (global as any).AbortException = AbortExceptionFactory;
    (global as any).AbortException = AbortExceptionFunction;
  }
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  // More complete DOMMatrix polyfill
  globalThis.DOMMatrix = class DOMMatrix {
    a: number = 1;
    b: number = 0;
    c: number = 0;
    d: number = 1;
    e: number = 0;
    f: number = 0;
    m11: number = 1;
    m12: number = 0;
    m21: number = 0;
    m22: number = 1;
    m41: number = 0;
    m42: number = 0;

    constructor(init?: string | number[]) {
      if (init) {
        if (typeof init === 'string') {
          // Parse matrix string
        } else if (Array.isArray(init)) {
          // Set from array
        }
      }
    }

    static fromMatrix(other?: DOMMatrix) {
      return new DOMMatrix();
    }

    static fromFloat32Array(array: Float32Array) {
      return new DOMMatrix();
    }

    static fromFloat64Array(array: Float64Array) {
      return new DOMMatrix();
    }

    multiply(other: DOMMatrix): DOMMatrix {
      return new DOMMatrix();
    }

    translate(x: number, y: number): DOMMatrix {
      return new DOMMatrix();
    }

    scale(x: number, y?: number): DOMMatrix {
      return new DOMMatrix();
    }

    rotate(angle: number): DOMMatrix {
      return new DOMMatrix();
    }

    rotateFromVector(x: number, y: number): DOMMatrix {
      return new DOMMatrix();
    }

    flipX(): DOMMatrix {
      return new DOMMatrix();
    }

    flipY(): DOMMatrix {
      return new DOMMatrix();
    }

    skewX(sx: number): DOMMatrix {
      return new DOMMatrix();
    }

    skewY(sy: number): DOMMatrix {
      return new DOMMatrix();
    }

    inverse(): DOMMatrix {
      return new DOMMatrix();
    }

    isIdentity(): boolean {
      return true;
    }
  } as any;
}

// Also polyfill other browser APIs that might be needed
if (typeof globalThis.DOMPoint === 'undefined') {
  globalThis.DOMPoint = class DOMPoint {
    x: number = 0;
    y: number = 0;
    z: number = 0;
    w: number = 1;

    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }

    static fromPoint(other?: DOMPoint) {
      return new DOMPoint();
    }
  } as any;
}

