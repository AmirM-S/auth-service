import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('کاربر با این ایمیل از قبل وجود دارد');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      passwordHash,
      roles: [],
    });

    //Default user role
    const userRole = await this.roleRepository.findOne({
      where: { name: 'user' },
    });
    if (userRole) {
      user.roles = [userRole];
    }

    return await this.userRepository.save(user);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      relations: ['roles', 'roles.permissions'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: id },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('کاربر با این ایمیل از قبل وجود دارد');
      }
    }

    Object.assign(user, updateUserDto);
    return await this.userRepository.save(user);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(id, { passwordHash });
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.passwordHash);
  }

  async lockUser(
    id: string,
    lockDuration: number = 15 * 60 * 1000,
  ): Promise<void> {
    const lockedUntil = new Date(Date.now() + lockDuration);
    await this.userRepository.update(id, {
      lockedUntil,
      failedLoginAttempts: 0,
    });
  }

  async unlockUser(id: string): Promise<void> {
    await this.userRepository.update(id, {
      lockedUntil: null,
      failedLoginAttempts: 0,
    });
  }

  async incrementFailedLoginAttempts(id: string): Promise<number> {
    await this.userRepository.increment({ id }, 'failedLoginAttempts', 1);
    const user = await this.userRepository.findOne({ where: { id } });
    return user.failedLoginAttempts;
  }

  async resetFailedLoginAttempts(id: string): Promise<void> {
    await this.userRepository.update(id, { failedLoginAttempts: 0 });
  }

  async setEmailVerificationToken(
    id: string,
    token: string,
    expires: Date,
  ): Promise<void> {}

  async verifyEmail(token: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('توکن صحیح نمی باشد');
    }

    await this.userRepository.update(user.id, {
      isVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    return user;
  }

  async setPasswordResetToken(
    email: string,
    token: string,
    expires: Date,
  ): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    await this.userRepository.update(user.id, {
      passwordResetToken: token,
      passwordResetExpires: expires,
    });

    return user;
  }

  async resetPassword(token: string, newPassword: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!user || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('توکن صحیح نمی باشد');
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.userRepository.update(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    return user;
  }

  async assignRole(userId: string, roleId: string): Promise<User> {
    const user = await this.findOne(userId);
    const role = await this.roleRepository.findOne({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundException('نقش یافت نشد');
    }

    if (!user.roles.some((r) => r.id === roleId)) {
      user.roles.push(role);
      await this.userRepository.save(user);
    }

    return user;
  }

  async removeRole(userId: string, roleId: string): Promise<User> {
    const user = await this.findOne(userId);
    user.roles = user.roles.filter((role) => role.id !== roleId);
    return await this.userRepository.save(user);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      return [];
    }

    const permissions = new Set<string>();
    user.roles.forEach((role) => {
      role.permissions.forEach((permission) => {
        permissions.add(`${permission.resource}:${permission.action}`);
      });
    });

    return Array.from(permissions);
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return (
      permissions.includes(`${resource}:${action}`) ||
      permissions.includes('*:*')
    );
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLogin: new Date() });
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;
    return await this.userRepository.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = true;
    return await this.userRepository.save(user);
  }
}
