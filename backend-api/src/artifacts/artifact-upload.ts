import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'crypto';
import { TextDecoder } from 'util';
import { ArtifactKind } from './artifact.entity';

export type ArtifactUpload = { originalname: string; mimetype: string; buffer: Buffer };
const formats = {
  html: { extensions: ['html', 'htm'], mime: 'text/html', limit: 5 * 1024 * 1024 },
  pdf: { extensions: ['pdf'], mime: 'application/pdf', limit: 20 * 1024 * 1024 },
  pptx: {
    extensions: ['pptx'],
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    limit: 20 * 1024 * 1024,
  },
} as const;

export function validateArtifactUpload(file: ArtifactUpload) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length)
    throw new BadRequestException('A nonempty file is required');
  if (
    typeof file.originalname !== 'string' ||
    /[\x00-\x1f\x7f/\\]/.test(file.originalname) ||
    file.originalname.length > 255
  )
    throw new BadRequestException('Invalid filename');
  const extension = file.originalname.split('.').pop().toLowerCase();
  const kind = (Object.keys(formats) as ArtifactKind[]).find(key =>
    (formats[key].extensions as readonly string[]).includes(extension),
  );
  if (!kind || file.mimetype !== formats[kind].mime)
    throw new BadRequestException('File extension and MIME must agree');
  if (file.buffer.length > formats[kind].limit)
    throw new PayloadTooLargeException('Artifact exceeds its size limit');
  if (kind === 'pdf' && file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
    throw new BadRequestException('Invalid PDF signature');
  if (kind === 'pptx' && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])))
    throw new BadRequestException('Invalid PPTX signature');
  if (kind === 'html') {
    let html: string;
    try {
      html = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException('HTML must be UTF-8');
    }
    if (
      html.includes('\0') ||
      !/^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b|<!--|<(?:div|p|h[1-6]|section|main|article|table|span)\b)/i.test(
        html,
      )
    )
      throw new BadRequestException('Invalid HTML document');
  }
  return {
    kind,
    extension,
    mimeType: formats[kind].mime,
    originalName: file.originalname,
    byteSize: file.buffer.length,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
    buffer: file.buffer,
  };
}

export function positiveInteger(value: unknown): number {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) value = Number(value);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new BadRequestException('A positive integer is required');
  return value;
}

export function artifactTitle(value: unknown, filename: string): string {
  const title = value === undefined ? filename.replace(/\.[^.]+$/, '').slice(0, 200) : value;
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 200 ||
    /[\x00-\x1f\x7f]/.test(title)
  )
    throw new BadRequestException('Title must contain 1 to 200 characters');
  return title.trim();
}
