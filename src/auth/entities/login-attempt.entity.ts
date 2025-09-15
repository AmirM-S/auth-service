import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('login_attempts')
@Index(['identifier'])
@Index(['createdAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  identifier: string;

  @Column({ default: 1 })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  blockedUntil: Date;

  @CreateDateColumn()
  createdAt: Date;
}