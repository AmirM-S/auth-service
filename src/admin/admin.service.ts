import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Permission } from '../users/entities/permission.entity';
import { AuthEvent, AuthEventType } from '../auth/entities/auth-event.entity';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(AuthEvent)
    private authEventRepository: Repository<AuthEvent>,
    private usersService: UsersService,
  ) {}

  // User Management
  async getUsers(page: number = 1, limit: number = 10, search?: string) {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.socialAccounts', 'socialAccounts')
      .orderBy('user.createdAt', 'DESC');

    if (search) {
      queryBuilder.where(
        'user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createUser(createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    return await this.usersService.update(id, updateUserDto);
  }

  async deleteUser(id: string) {
    const user = await this.usersService.findOne(id);
    await this.userRepository.softRemove(user);
    return { message: 'User deleted successfully' };
  }

  async getUserStats() {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });
    const verifiedUsers = await this.userRepository.count({
      where: { isVerified: true },
    });

    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await this.userRepository.count({
      where: { createdAt: Between(oneWeekAgo, today) },
    });

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      newUsersThisWeek,
      inactiveUsers: totalUsers - activeUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
    };
  }

  // Role Management
  async getRoles() {
    return await this.roleRepository.find({
      relations: ['permissions'],
      order: { createdAt: 'DESC' },
    });
  }

  async createRole(name: string, description?: string) {
    const role = this.roleRepository.create({ name, description });
    return await this.roleRepository.save(role);
  }

  async updateRole(id: string, name?: string, description?: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;

    return await this.roleRepository.save(role);
  }

  async deleteRole(id: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystemRole) {
      throw new Error('Cannot delete system roles');
    }

    await this.roleRepository.remove(role);
    return { message: 'Role deleted successfully' };
  }

  async assignRoleToUser(userId: string, roleId: string) {
    return await this.usersService.assignRole(userId, roleId);
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return await this.usersService.removeRole(userId, roleId);
  }

  // Permission Management
  async getPermissions() {
    return await this.permissionRepository.find({
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  async createPermission(
    resource: string,
    action: string,
    description?: string,
  ) {
    const permission = this.permissionRepository.create({
      resource,
      action,
      description,
    });
    return await this.permissionRepository.save(permission);
  }

  async assignPermissionToRole(roleId: string, permissionId: string) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!role || !permission) {
      throw new NotFoundException('Role or permission not found');
    }

    if (!role.permissions.some((p) => p.id === permissionId)) {
      role.permissions.push(permission);
      await this.roleRepository.save(role);
    }

    return role;
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    role.permissions = role.permissions.filter((p) => p.id !== permissionId);
    return await this.roleRepository.save(role);
  }

  // Audit Logs
  async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    eventType?: string,
  ) {
    const queryBuilder = this.authEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .orderBy('event.createdAt', 'DESC');

    if (userId) {
      queryBuilder.andWhere('event.userId = :userId', { userId });
    }

    if (eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', { eventType });
    }

    const [events, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Analytics
  async getLoginAnalytics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const loginStats = await this.authEventRepository
      .createQueryBuilder('event')
      .select('DATE(event.createdAt)', 'date')
      .addSelect(
        'COUNT(CASE WHEN event.success = true THEN 1 END)',
        'successfulLogins',
      )
      .addSelect(
        'COUNT(CASE WHEN event.success = false THEN 1 END)',
        'failedLogins',
      )
      .where('event.createdAt >= :startDate', { startDate })
      .andWhere("event.eventType IN ('login_success', 'login_failed')")
      .groupBy('DATE(event.createdAt)')
      .orderBy('date', 'DESC')
      .getRawMany();

    return loginStats;
  }

  async getSecurityMetrics() {
    const totalEvents = await this.authEventRepository.count();
    const suspiciousActivities = await this.authEventRepository.count({
      where: { eventType: AuthEventType.SUSPICIOUS_ACTIVITY },
    });
    const failedLogins = await this.authEventRepository.count({
      where: { eventType: AuthEventType.LOGIN_FAILED },
    });
    const successfulLogins = await this.authEventRepository.count({
      where: { eventType: AuthEventType.LOGIN_SUCCESS },
    });

    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentSuspiciousActivities = await this.authEventRepository.count({
      where: {
        eventType: AuthEventType.SUSPICIOUS_ACTIVITY,
        createdAt: Between(oneWeekAgo, today),
      },
    });

    return {
      totalEvents,
      suspiciousActivities,
      failedLogins,
      successfulLogins,
      recentSuspiciousActivities,
      successRate:
        totalEvents > 0
          ? (successfulLogins / (successfulLogins + failedLogins)) * 100
          : 0,
    };
  }
}
