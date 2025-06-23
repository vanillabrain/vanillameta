import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  name: string;

  @Column({ length: 100, nullable: true })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ 
    type: 'text', 
    nullable: true,
    transformer: {
      to: (value: string[]) => value ? JSON.stringify(value) : null,
      from: (value: string) => value ? JSON.parse(value) : []
    }
  })
  permissions: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemRole: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}