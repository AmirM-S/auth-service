import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { Exclude } from 'class-transformer'

@Entity('users')
@Index(['email'], { unique: true})
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({unique: true})
    email: string;

    @Column()
    @Exclude()
    passwordHash: string;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column({ nullable: true })
    phone: string

    @Column({ default: true })
    isActive: boolean

    @Column({ default: false })
    isVerified: boolean
}