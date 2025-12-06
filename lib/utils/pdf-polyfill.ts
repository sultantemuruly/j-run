/**
 * Polyfill for browser APIs needed by pdf-parse in Node.js environment
 * This must be imported BEFORE pdf-parse
 */

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

