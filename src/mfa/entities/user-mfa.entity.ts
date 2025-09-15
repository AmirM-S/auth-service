import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MfaType {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
}

@Entity('user_mfa')
@Index(['userId', 'type'], { unique: true })
export class UserMfa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.mfaSettings, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: MfaType,
  })
  type: MfaType;

  @Column({ nullable: true })
  secret: string; // Encrypted TOTP secret

  @Column({ type: 'text', array: true, nullable: true })
  backupCodes: string[]; // Encrypted backup codes

  @Column({ default: false })
  isEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}