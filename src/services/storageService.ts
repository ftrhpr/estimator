import * as ImageManipulator from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebaseConfig';

export class StorageService {
  private static readonly ESTIMATE_PHOTOS_PATH = 'estimate-photos';
  private static readonly WEBP_QUALITY = 0.85; // 85% quality reduces file size ~40-50%

  /**
   * Convert image to WebP format for storage optimization
   * @param imageUri - Local image URI
   * @returns Promise<string> - URI of WebP-converted image
   */
  private static async convertToWebP(imageUri: string): Promise<string> {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [], // No transformations, just convert format
        { 
          compress: this.WEBP_QUALITY, // 0.85 = 85% quality
          format: ImageManipulator.SaveFormat.WEBP,
        }
      );
      return manipResult.uri;
    } catch (error) {
      console.warn('WebP conversion failed, uploading original image:', error);
      // Fallback to original image if conversion fails
      return imageUri;
    }
  }

  /**
   * Upload an image to Firebase Storage (converts to WebP first)
   * @param imageUri - Local image URI
   * @param fileName - Custom file name (optional)
   * @returns Promise<string> - Download URL of uploaded image
   */
  static async uploadEstimatePhoto(imageUri: string, fileName?: string): Promise<string> {
    try {
      // Convert image to WebP format for storage optimization
      console.log('Converting image to WebP format...');
      const webpUri = await this.convertToWebP(imageUri);
      
      // Generate unique filename if not provided
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const finalFileName = fileName || `photo_${timestamp}_${randomId}.webp`;
      
      // Create storage reference
      const imageRef = ref(storage, `${this.ESTIMATE_PHOTOS_PATH}/${finalFileName}`);
      
      // Convert image URI to blob
      const response = await fetch(webpUri);
      const blob = await response.blob();
      
      console.log(`Uploading image (${(blob.size / 1024).toFixed(2)} KB in WebP format)`);
      
      // Upload image
      const uploadResult = await uploadBytes(imageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      console.log('Image uploaded successfully as WebP:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  }

  /**
   * Delete an image from Firebase Storage
   * @param imageUrl - Full download URL of the image
   */
  static async deleteEstimatePhoto(imageUrl: string): Promise<void> {
    try {
      // Extract path from URL
      const urlParts = imageUrl.split('/');
      const pathParts = urlParts[urlParts.length - 1].split('?')[0];
      const decodedPath = decodeURIComponent(pathParts);
      
      // Create reference and delete
      const imageRef = ref(storage, `${this.ESTIMATE_PHOTOS_PATH}/${decodedPath}`);
      await deleteObject(imageRef);
      
      console.log('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image.');
    }
  }

  /**
   * Upload multiple images
   * @param imageUris - Array of local image URIs
   * @returns Promise<string[]> - Array of download URLs
   */
  static async uploadMultipleEstimatePhotos(imageUris: string[]): Promise<string[]> {
    try {
      const uploadPromises = imageUris.map(uri => this.uploadEstimatePhoto(uri));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw new Error('Failed to upload one or more images.');
    }
  }

  /**
   * Get optimized image URL with resize parameters
   * @param originalUrl - Original Firebase Storage URL
   * @param width - Desired width (optional)
   * @param height - Desired height (optional)
   * @returns Optimized URL
   */
  static getOptimizedImageUrl(originalUrl: string, width?: number, height?: number): string {
    // For Firebase Storage, we can add transform parameters if using a CDN
    // For now, return original URL
    return originalUrl;
  }
}