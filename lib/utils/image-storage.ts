import fs from 'fs/promises';
import path from 'path';

export interface StoredImage {
  id: string;
  filePath: string;
  sourceDocument: string;
  metadata: {
    section?: string;
    topic?: string;
    subtopic?: string;
    difficulty?: string;
    imageIndex: number;
    chunkIndex?: number;
  };
}

/**
 * Image storage service
 * Stores extracted images from documents and links them to chunks
 */
class ImageStorage {
  private storagePath: string;
  private images: Map<string, StoredImage> = new Map();

  constructor(storagePath: string = './.cache/images') {
    this.storagePath = storagePath;
  }

  /**
   * Store an image and return its ID
   */
  async storeImage(
    imageData: Buffer,
    filename: string,
    sourceDocument: string,
    metadata: StoredImage['metadata']
  ): Promise<string> {
    // Create storage directory if it doesn't exist
    await fs.mkdir(this.storagePath, { recursive: true });

    // Generate unique ID
    const imageId = `${path.basename(sourceDocument, path.extname(sourceDocument))}_img_${metadata.imageIndex}_${Date.now()}`;
    const filePath = path.join(this.storagePath, `${imageId}.png`);

    // Save image file
    await fs.writeFile(filePath, imageData);

    // Store metadata
    const storedImage: StoredImage = {
      id: imageId,
      filePath,
      sourceDocument,
      metadata,
    };

    this.images.set(imageId, storedImage);

    return imageId;
  }

  /**
   * Get image by ID
   */
  getImage(imageId: string): StoredImage | undefined {
    return this.images.get(imageId);
  }

  /**
   * Get all images for a source document
   */
  getImagesBySource(sourceDocument: string): StoredImage[] {
    return Array.from(this.images.values()).filter(
      img => img.sourceDocument === sourceDocument
    );
  }

  /**
   * Get images by metadata (section, topic, difficulty)
   */
  getImagesByMetadata(metadata: Partial<StoredImage['metadata']>): StoredImage[] {
    return Array.from(this.images.values()).filter(img => {
      return Object.entries(metadata).every(([key, value]) => {
        return img.metadata[key as keyof typeof img.metadata] === value;
      });
    });
  }

  /**
   * Get image file path (for serving)
   */
  getImagePath(imageId: string): string | undefined {
    const image = this.images.get(imageId);
    return image?.filePath;
  }

  /**
   * Get image as base64 (for API responses)
   */
  async getImageAsBase64(imageId: string): Promise<string | undefined> {
    const image = this.images.get(imageId);
    if (!image) return undefined;

    try {
      const imageData = await fs.readFile(image.filePath);
      return `data:image/png;base64,${imageData.toString('base64')}`;
    } catch (error) {
      console.error(`Failed to read image ${imageId}:`, error);
      return undefined;
    }
  }

  /**
   * Save image index to disk
   */
  async saveIndex(): Promise<void> {
    // Ensure directory exists before writing
    await fs.mkdir(this.storagePath, { recursive: true });
    const indexPath = path.join(this.storagePath, 'index.json');
    const indexData = Array.from(this.images.entries());
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  }

  /**
   * Load image index from disk
   */
  async loadIndex(): Promise<void> {
    const indexPath = path.join(this.storagePath, 'index.json');
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const indexData = JSON.parse(data) as Array<[string, StoredImage]>;
      this.images = new Map(indexData);
    } catch (error) {
      // Index doesn't exist yet, that's okay
      console.log('No image index found, starting fresh');
    }
  }

  /**
   * Clear all stored images
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      for (const file of files) {
        if (file !== 'index.json') {
          await fs.unlink(path.join(this.storagePath, file));
        }
      }
      this.images.clear();
    } catch (error) {
      console.error('Error clearing images:', error);
    }
  }

  /**
   * Get count of stored images
   */
  getImageCount(): number {
    return this.images.size;
  }
}

// Singleton instance
export const imageStorage = new ImageStorage();

