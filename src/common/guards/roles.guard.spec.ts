import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RolesGuard } from './roles.guard';

function createContext(role?: string): any {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  };
}

describe('RolesGuard', () => {
  it('allows admins through role-protected endpoints', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key) =>
        key === IS_PUBLIC_KEY ? false : ['BUYER'],
      ),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('ADMIN'))).toBe(true);
  });

  it('allows users with an explicitly permitted role', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key) =>
        key === ROLES_KEY ? ['GROOMER'] : false,
      ),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext('GROOMER'))).toBe(true);
  });

  it('rejects non-admin users without the required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key) =>
        key === ROLES_KEY ? ['GROOMER'] : false,
      ),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext('BUYER'))).toThrow(
      ForbiddenException,
    );
  });
});
