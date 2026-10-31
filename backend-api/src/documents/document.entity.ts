import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { DocumentSummary } from './document-summary.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';

@Entity('document_connection')
@Index('UQ_document_owner_org_file', ['ownerId', 'organizationId', 'fileId'], { unique: true })
export class DocumentConnection {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'varchar', length: 200 }) fileId: string;
  @Column({ type: 'varchar', length: 20, default: 'google' }) provider: 'google' | 'microsoft';
  @Column({ type: 'varchar', length: 1000 }) title: string;
  @Column({ type: 'integer' }) currentVersion: number;
  @Column({ type: 'integer' }) generation: number;
  @Column({ type: 'integer' }) credentialEpoch: number;
  @Column({ type: 'text' }) credentials: string;
  @Column({ type: 'boolean' }) connected: boolean;
  @Column({ type: 'varchar', length: 30 }) updatedAt: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ownerId' })
  ownerIdReference: User;
  @ManyToOne(() => EnterpriseOrganization, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizationId' })
  organizationIdReference: EnterpriseOrganization;
}

@Entity('document_authorization')
export class DocumentAuthorization {
  @PrimaryColumn({ type: 'varchar', length: 64 }) id: string;
  @Column({ type: 'varchar', length: 36 }) documentId: string;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) epoch: number;
  @Column({ type: 'integer' }) generation: number;
  @Column({ type: 'varchar', length: 200 }) fileId: string;
  @Column({ type: 'varchar', length: 16 }) status: 'pending' | 'claimed' | 'failed' | 'completed';
  @Column({ type: 'text' }) verifier: string;
  @Column({ type: 'varchar', length: 30 }) expiresAt: string;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ownerId' })
  ownerIdReference: User;
  @ManyToOne(() => EnterpriseOrganization, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizationId' })
  organizationIdReference: EnterpriseOrganization;
}

@Entity('document_refresh')
export class DocumentRefresh {
  @PrimaryColumn({ type: 'varchar', length: 36 }) documentId: string;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'integer' }) expectedVersion: number;
  @Column({ type: 'integer' }) generation: number;
  @Column({ type: 'integer' }) epoch: number;
  @Column({ type: 'varchar', length: 16 }) status: 'running' | 'failed' | 'completed';
  @Column({ type: 'varchar', length: 36 }) token: string;
  @Column({ type: 'varchar', length: 30 }) leaseUntil: string;
  @Column({ type: 'text' }) result: string;
  @ManyToOne(() => DocumentConnection, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'documentId' })
  document: DocumentConnection;
}

@Entity('document_version')
export class DocumentVersion {
  @PrimaryColumn({ type: 'varchar', length: 36 }) documentId: string;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 200 }) sourceVersion: string;
  @Column({ type: 'varchar', length: 30 }) sourceModifiedAt: string;
  @Column({ type: 'varchar', length: 30 }) capturedAt: string;
  @Column({ type: 'varchar', length: 64 }) sha256: string;
  @Column({ type: 'integer' }) byteSize: number;
  @ManyToOne(() => DocumentConnection, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'documentId' })
  document: DocumentConnection;
}

@Entity('document_chunk')
export class DocumentChunk {
  @PrimaryColumn({ type: 'varchar', length: 36 }) documentId: string;
  @PrimaryColumn({ type: 'integer' }) version: number;
  @PrimaryColumn({ type: 'integer' }) position: number;
  @Column({ type: 'text' }) content: string;
  @ManyToOne(() => DocumentConnection, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'documentId' })
  document: DocumentConnection;
}

export const DOCUMENT_ENTITIES = [
  DocumentConnection,
  DocumentAuthorization,
  DocumentRefresh,
  DocumentVersion,
  DocumentChunk,
  DocumentSummary,
];
