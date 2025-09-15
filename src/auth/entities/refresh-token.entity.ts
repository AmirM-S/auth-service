  import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    Index,
  } from 'typeorm';
  import { User } from '../../users/entities/user.entity';
  
  @Entity('refresh_tokens')
  @Index(['tokenHash'])
  export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
    user: User;
  
    @Column()
    tokenHash: string;
  
    @Column()
    expiresAt: Date;
  
    @Column({ nullable: true })
    deviceInfo: string;
  
    @Column({ nullable: true })
    ipAddress: string;
  
    @Column({ default: false })
    isRevoked: boolean;
  
    @CreateDateColumn()
    createdAt: Date;
  }