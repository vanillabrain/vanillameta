import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('enterprise_organization')
export class EnterpriseOrganization {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 100 }) name: string;
  @Column({ type: 'integer', default: 1 }) version: number;
}
