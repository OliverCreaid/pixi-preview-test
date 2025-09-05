/**
 * Node.js implementation of file system interface
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { IFileSystem } from '../../core/interfaces/EnvironmentInterface';

export class NodeFileSystem implements IFileSystem {
  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error);
      throw error;
    }
  }

  async writeFile(filePath: string, data: any): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write data - handle different data types
      let content: string | Buffer;
      if (Buffer.isBuffer(data)) {
        content = data;
      } else if (typeof data === 'string') {
        content = data;
      } else {
        content = JSON.stringify(data, null, 2);
      }

      await fs.writeFile(filePath, content);
    } catch (error) {
      console.error(`Failed to write file: ${filePath}`, error);
      throw error;
    }
  }

  exists(filePath: string): boolean {
    try {
      fsSync.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  createDirectory(dirPath: string): void {
    try {
      fsSync.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory: ${dirPath}`, error);
      throw error;
    }
  }

  // Additional Node.js specific methods
  async readBuffer(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error(`Failed to read buffer: ${filePath}`, error);
      throw error;
    }
  }

  async writeBuffer(filePath: string, buffer: Buffer): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, buffer);
    } catch (error) {
      console.error(`Failed to write buffer: ${filePath}`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Failed to delete file: ${filePath}`, error);
      throw error;
    }
  }

  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      if (extension) {
        return files.filter(file => path.extname(file) === extension);
      }
      return files;
    } catch (error) {
      console.error(`Failed to list files: ${dirPath}`, error);
      throw error;
    }
  }

  async getFileStats(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    isFile: boolean;
    isDirectory: boolean;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      console.error(`Failed to get file stats: ${filePath}`, error);
      throw error;
    }
  }
}