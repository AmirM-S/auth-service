import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // User Management
  @Get('users')
  @RequirePermissions('admin:read', 'user:read')
  @ApiOperation({ summary: 'Get all users (admin)' })
  async getUsers(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(page, limit, search);
  }

  @Post('users')
  @RequirePermissions('admin:create', 'user:create')
  @ApiOperation({ summary: 'Create user (admin)' })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.adminService.createUser(createUserDto);
  }

  @Put('users/:id')
  @RequirePermissions('admin:update', 'user:update')
  @ApiOperation({ summary: 'Update user (admin)' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @RequirePermissions('admin:delete', 'user:delete')
  @ApiOperation({ summary: 'Delete user (admin)' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('users/stats')
  @RequirePermissions('admin:read')
  @ApiOperation({ summary: 'Get user statistics' })
  async getUserStats() {
    return this.adminService.getUserStats();
  }

  // Role Management
  @Get('roles')
  @RequirePermissions('admin:read', 'role:read')
  @ApiOperation({ summary: 'Get all roles' })
  async getRoles() {
    return this.adminService.getRoles();
  }

  @Post('roles')
  @RequirePermissions('admin:create', 'role:create')
  @ApiOperation({ summary: 'Create role' })
  async createRole(
    @Body() { name, description }: { name: string; description?: string },
  ) {
    return this.adminService.createRole(name, description);
  }

  @Put('roles/:id')
  @RequirePermissions('admin:update', 'role:update')
  @ApiOperation({ summary: 'Update role' })
  async updateRole(
    @Param('id') id: string,
    @Body() { name, description }: { name?: string; description?: string },
  ) {
    return this.adminService.updateRole(id, name, description);
  }

  @Delete('roles/:id')
  @RequirePermissions('admin:delete', 'role:delete')
  @ApiOperation({ summary: 'Delete role' })
  async deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  @Post('users/:userId/roles/:roleId')
  @RequirePermissions('admin:update', 'user:update')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.adminService.assignRoleToUser(userId, roleId);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('admin:update', 'user:update')
  @ApiOperation({ summary: 'Remove role from user' })
  async removeRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.adminService.removeRoleFromUser(userId, roleId);
  }

  // Permission Management
  @Get('permissions')
  @RequirePermissions('admin:read', 'permission:read')
  @ApiOperation({ summary: 'Get all permissions' })
  async getPermissions() {
    return this.adminService.getPermissions();
  }

  @Post('permissions')
  @RequirePermissions('admin:create', 'permission:create')
  @ApiOperation({ summary: 'Create permission' })
  async createPermission(
    @Body()
    {
      resource,
      action,
      description,
    }: {
      resource: string;
      action: string;
      description?: string;
    },
  ) {
    return this.adminService.createPermission(resource, action, description);
  }

  @Post('roles/:roleId/permissions/:permissionId')
  @RequirePermissions('admin:update', 'role:update')
  @ApiOperation({ summary: 'Assign permission to role' })
  async assignPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.adminService.assignPermissionToRole(roleId, permissionId);
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @RequirePermissions('admin:update', 'role:update')
  @ApiOperation({ summary: 'Remove permission from role' })
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.adminService.removePermissionFromRole(roleId, permissionId);
  }

  // Audit & Analytics
  @Get('audit-logs')
  @RequirePermissions('admin:read', 'audit:read')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 50,
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.adminService.getAuditLogs(page, limit, userId, eventType);
  }

  @Get('analytics/logins')
  @RequirePermissions('admin:read', 'analytics:read')
  @ApiOperation({ summary: 'Get login analytics' })
  async getLoginAnalytics(@Query('days', ParseIntPipe) days: number = 30) {
    return this.adminService.getLoginAnalytics(days);
  }

  @Get('analytics/security')
  @RequirePermissions('admin:read', 'analytics:read')
  @ApiOperation({ summary: 'Get security metrics' })
  async getSecurityMetrics() {
    return this.adminService.getSecurityMetrics();
  }
}
